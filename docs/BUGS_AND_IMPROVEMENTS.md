# FarmChain — Bugs & Improvements

> Audited: 2026-06-06  
> Branch: `develop`  
> Status: **Pre-implementation — do not merge until fixed**

---

## Legend

| Priority | Meaning |
|----------|---------|
| 🔴 Critical | Breaks core functionality; system cannot work without a fix |
| 🟠 High | Security hole or significant data integrity issue |
| 🟡 Medium | Feature gap or logic error that degrades UX |
| 🟢 Low | Polish, robustness, or developer-experience improvement |

---

## 1. Smart Contracts (`contracts/`)

### 🔴 C-1 — `soroban.ts`: Every contract call passes empty `[]` args

**File:** `frontend/src/lib/soroban.ts`

Every exported wrapper passes an empty array as the third argument to `invoke()`:

```ts
export const registerUser = (publicKey, role, metadataHash) =>
  invoke(REGISTRY_ID, 'register_user', [], publicKey);  // ← [] no args

export const listProduct = (farmerKey, priceStroops, qty, hash) =>
  invoke(MARKETPLACE_ID, 'list_product', [], farmerKey); // ← [] no args

export const createOrder = (...) => invoke(ESCROW_ID, 'create_order', [], buyerKey);
export const markShipped = (...) => invoke(ESCROW_ID, 'mark_shipped', [], farmerKey);
export const confirmDelivery = (...) => invoke(ESCROW_ID, 'confirm_delivery', [], buyerKey);
export const raiseDispute = (...) => invoke(ESCROW_ID, 'raise_dispute', [], callerKey);
```

Every contract call will be rejected by the Soroban VM because the required arguments are absent. The function parameters are accepted but silently discarded. All contract interactions in the app are broken.

**Fix:** Build and pass the correct `xdr.ScVal[]` for each method. Example for `register_user`:
```ts
import { xdr, Address } from '@stellar/stellar-sdk';

export const registerUser = (publicKey: string, role: string, metadataHash: string) =>
  invoke(REGISTRY_ID, 'register_user', [
    new Address(publicKey).toScVal(),
    xdr.ScVal.scvSymbol(role),
    xdr.ScVal.scvBytes(Buffer.from(metadataHash, 'hex')),
  ], publicKey);
```
Repeat for all other wrappers with their correct argument types.

---

### 🔴 C-2 — `soroban.ts`: `invoke()` returns without waiting for confirmation

**File:** `frontend/src/lib/soroban.ts:24-29`

`server.sendTransaction()` returns a `PENDING` status immediately; the actual result is only available after polling `server.getTransaction()`. The current code returns the pending response as if it were final:

```ts
const response = await server.sendTransaction(...);
return response;  // ← status is "PENDING", not success or failure
```

Any caller that checks for success based on this response will get a false positive. Errors and on-chain failures are silently swallowed.

**Fix:** After `sendTransaction`, poll `server.getTransaction(response.hash)` until status is `SUCCESS` or `FAILED`, with a timeout:

```ts
let txResult = await server.getTransaction(response.hash);
const deadline = Date.now() + 30_000;
while (txResult.status === rpc.GetTransactionStatus.NOT_FOUND && Date.now() < deadline) {
  await new Promise(r => setTimeout(r, 2000));
  txResult = await server.getTransaction(response.hash);
}
if (txResult.status !== rpc.GetTransactionStatus.SUCCESS) {
  throw new Error(`Transaction failed: ${txResult.status}`);
}
return txResult;
```

---

### 🔴 C-3 — `soroban.ts`: `getProduct` uses a hardcoded mainnet public key

**File:** `frontend/src/lib/soroban.ts:43`

```ts
const account = await server.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN');
```

This hardcoded account may not exist on testnet and will have no funds for fees. Read-only simulation should use the connected user's public key or a configurable funded account.

**Fix:** Accept a `callerKey` parameter and use `server.getAccount(callerKey)`.

---

### 🟡 C-4 — `marketplace/lib.rs`: `update_product` skips price/quantity validation

**File:** `contracts/marketplace/src/lib.rs:102-128`

`list_product` correctly asserts `price > 0` and `quantity > 0`. `update_product` has no such checks:

```rust
product.price = price;     // could be 0 or negative
product.quantity = quantity; // could be 0
```

**Fix:** Add the same assertions at the start of `update_product`:
```rust
assert!(price > 0, "price must be positive");
assert!(quantity > 0, "quantity must be positive");
```

---

### 🟡 C-5 — `escrow/lib.rs`: Escrow never notifies marketplace when order completes

**File:** `contracts/escrow/src/lib.rs:147-178`

The marketplace contract's `mark_sold` is documented as "called by escrow contract after order confirmed" but there is no cross-contract call in `confirm_delivery` or `resolve_dispute`. Products remain `Active` on-chain even after being fully sold.

**Fix:** Add a cross-contract call to `MarketplaceContract::mark_sold` in both `confirm_delivery` and `resolve_dispute` (when `farmer_bps == 10_000`). Requires storing the marketplace contract address in escrow's init.

---

### 🟡 C-6 — `registry/lib.rs`: No way to reactivate a deactivated user

**File:** `contracts/registry/src/lib.rs:108-126`

`deactivate_user` sets `active = false` with no corresponding `activate_user` function. A mistakenly deactivated user is permanently locked out.

**Fix:** Add an `activate_user(env, address)` function with the same admin-auth guard.

---

### 🟠 C-7 — `escrow/lib.rs`: Critical config stored in `instance` storage

**File:** `contracts/escrow/src/lib.rs:64-65` and `contracts/registry/src/lib.rs:45-46`

`DataKey::Admin` and `DataKey::Token` (the XLM token address) are stored with `env.storage().instance()`. Instance storage has a shorter TTL than persistent storage. If the ledger entry expires, the contract becomes unusable because no one can reinitialise it (the `init` guard panics on re-call).

**Fix:** Use `env.storage().persistent()` for `Admin` and `Token` keys, or at minimum call `env.storage().instance().extend_ttl()` regularly.

---

## 2. Backend (`backend/`)

### 🔴 B-1 — Missing purchase flow: no endpoint to fund an order on-chain and sync DB

**File:** `backend/src/routes/orders.ts`

The `PATCH /:id/fund` endpoint exists but the on-chain escrow `create_order` call is never triggered from the backend, and the frontend has no page for it either. The flow from "buyer clicks Buy" to "escrow holds funds" is entirely absent. See also **F-1**.

---

### 🟠 B-2 — Order mutations have no party-authorization checks

**File:** `backend/src/routes/orders.ts`

The following endpoints authenticate the caller (JWT required) but never verify the caller is the correct party for the order:

| Endpoint | Should check |
|----------|-------------|
| `PATCH /:id/fund` | caller is the order's `buyer_pk` |
| `POST /:id/ship` | caller is the order's `farmer_pk` |
| `POST /:id/complete` | caller is the order's `buyer_pk` |
| `POST /:id/dispute` | caller is `buyer_pk` or `farmer_pk` |

Any authenticated user can ship, complete, or dispute any order.

**Fix:** Fetch the order first, compare `req.user!.publicKey` against the expected field, and return `403` on mismatch.

---

### 🟠 B-3 — Login has no cryptographic proof of key ownership

**File:** `backend/src/routes/auth.ts:40-56`

Anyone who knows a user's Stellar public key can obtain a valid JWT for that account by calling `POST /auth/login`. There is no signature challenge — the public key alone grants access.

**Fix:** Implement a challenge-response flow:
1. Client calls `GET /auth/challenge?publicKey=G...` → server returns a time-limited nonce stored in a short-lived cache.
2. Client signs the nonce with Freighter and sends `POST /auth/login { publicKey, signedChallenge }`.
3. Server verifies the signature using `stellar-sdk`'s `Keypair.verify`.

---

### 🟡 B-4 — `GET /products` and several other routes have no error handling

**File:** `backend/src/routes/products.ts:25-34`, `orders.ts:8-17`, `users.ts`

Any uncaught DB error in these routes results in an unhandled promise rejection (Express will return a generic 500 in newer versions, but no client-friendly error message):

```ts
router.get('/', async (_req, res) => {
  const result = await pool.query(...); // ← no try/catch
  res.json({ products: result.rows });
});
```

**Fix:** Wrap all route handlers in `try/catch` and return `res.status(500).json({ error: ... })`.

---

### 🟡 B-5 — Mutations silently succeed even when 0 rows affected

**File:** `backend/src/routes/products.ts:71-78`, `orders.ts:47-53`, `users.ts:13-18`

Endpoints like `activate`, `fund`, and `verify-chain` always return `{ ok: true }` regardless of whether the UPDATE found a matching row:

```ts
await pool.query(`UPDATE products SET status = 'active' ... WHERE id = $2 AND farmer_pk = $3`, ...);
res.json({ ok: true }); // ← even if rowCount === 0
```

**Fix:** Check `result.rowCount` and return `404` or `403` if no rows were updated.

---

### 🟡 B-6 — `resolve` endpoint maps partial payouts to `completed`

**File:** `backend/src/routes/orders.ts:98`

```ts
const status = farmerBps === 0 ? 'refunded' : 'completed';
```

If the admin splits the payout (e.g. 30% farmer / 70% buyer), the DB status is `completed`, which is misleading. The on-chain `resolve_dispute` correctly sets the status to `Resolved`.

**Fix:** Map `farmerBps === 0` → `'refunded'`, `farmerBps === 10000` → `'completed'`, anything else → `'resolved'`.

---

### 🟢 B-7 — `orders.status` and `disputes.status` have no DB CHECK constraint

**File:** `backend/src/db/schema.sql:32-46`, `49-58`

`products.status` has a `CHECK` constraint but `orders.status` and `disputes.status` do not. Invalid values can be written directly to the DB.

**Fix:** Add:
```sql
status TEXT NOT NULL DEFAULT 'created'
  CHECK (status IN ('created','funded','shipped','completed','disputed','refunded','resolved')),
```

---

## 3. Frontend (`frontend/`)

### 🔴 F-1 — No product detail page and no buy flow

**File:** `frontend/src/App.tsx`, `frontend/src/components/marketplace/ProductCard.tsx`

`ProductCard` links to `/marketplace/${product.id}` but this route does not exist in `App.tsx`. Clicking any product card navigates to `*` and redirects to `/`. There is also no page, form, or hook to place an order (create order in DB + call escrow `create_order` on-chain).

**Fix:**
1. Add route `<Route path="/marketplace/:id" element={<ProductDetail />} />` in `App.tsx`.
2. Create `ProductDetail.tsx` showing product info and a "Buy" form that lets the buyer set quantity and triggers the two-step flow: `createOrder` (DB) → `createOrder` (Soroban escrow) → `fundOrder` (DB update with `onChainOrderId` and `txHash`).

---

### 🔴 F-2 — `ListProduct.tsx`: `activateProduct` is never called after Soroban listing

**File:** `frontend/src/pages/ListProduct.tsx:43-48`

After `listProduct` (Soroban) succeeds, the backend product is never updated:

```ts
await listProduct(publicKey, BigInt(xlmToStroops(data.priceXlm)), BigInt(data.quantity), metadataHash);
// Missing: await activateProduct(productId, { onChainId: ..., txHash: ... })
```

Products are permanently stuck with `status = 'pending'` and `on_chain_id = null`, so they never appear in the marketplace.

**Fix:** After the Soroban call returns, extract the on-chain product ID from the transaction result and call `activateProduct(productId, { onChainId, txHash })`.

---

### 🔴 F-3 — `AuthPage.tsx`: Returning user redirected using stale local role state

**File:** `frontend/src/pages/AuthPage.tsx:17-19`

```ts
const pk = await connect(isNew ? role : undefined, isNew ? name : undefined);
if (!pk) return;
const storedRole = role;  // ← local state, default: 'Farmer'
if (storedRole === 'Farmer') navigate('/farmer/dashboard');
else navigate('/buyer/dashboard');
```

For a returning user (`isNew = false`), `role` is the local state initialized to `'Farmer'` and never updated from the server response. Every returning Buyer is sent to `/farmer/dashboard` and immediately redirected to `/` by `ProtectedRoute`.

**Fix:** Use the role returned by `useWallet().role` (which is set from the server) after the `connect()` call resolves, not the local `role` state.

---

### 🔴 F-4 — Wallet state lost on page refresh (no session persistence)

**File:** `frontend/src/store/walletStore.ts`

Zustand state is in-memory. On refresh the store resets, but the JWT is still in `localStorage`. The app has no code to hydrate the store from `localStorage` on load. Users are effectively logged out on every page refresh.

**Fix:** In `main.tsx` or a root component, on mount read `fc_token` from `localStorage`, decode it (e.g. with `jwt-decode`), and call `setWallet(publicKey, role, token)` if the token is not expired.

---

### 🟡 F-5 — `useProducts` effect ignores `params` changes

**File:** `frontend/src/hooks/useProducts.ts:10-14`

```ts
useEffect(() => {
  getProducts(params)...
}, []); // ← params not in deps
```

If `params` changes (e.g. a filter is applied), the effect does not re-run and stale data is displayed.

**Fix:** Add `params` to the dependency array. Use `JSON.stringify(params)` if the object reference changes each render.

---

### 🟡 F-6 — `FarmerDashboard` fetches all marketplace products and filters client-side

**File:** `frontend/src/pages/FarmerDashboard.tsx:10-13`

```ts
const { products } = useProducts();           // fetches ALL active products
const myProducts = products.filter((p) => p.farmerPk === publicKey);
```

This fetches the entire marketplace and discards most of it. As the marketplace grows, this becomes slow and wastes bandwidth.

**Fix:** Add a `farmer_pk` query parameter to `GET /products` and filter server-side, or create a `GET /products?mine=true` endpoint that uses the authenticated user's public key.

---

### 🟢 F-7 — `ProductCard` uses public IPFS gateway without fallback on error

**File:** `frontend/src/components/marketplace/ProductCard.tsx:7-9`

The `/placeholder-produce.jpg` fallback is referenced but does not exist in `public/`. If IPFS fetch fails (network, unpinned CID), the `<img>` shows a broken image.

**Fix:** Add `onError={(e) => { e.currentTarget.src = '/fallback.png' }}` to the `<img>` tag and place a fallback image in `public/`.

---

## 4. Security

### 🔴 S-1 — Real secrets committed to `backend/.env`

**File:** `backend/.env`

The committed `.env` contains live credentials:
- `PINATA_API_KEY` and `PINATA_SECRET_KEY` — valid Pinata API keys
- `JWT_SECRET` — appears to be a real Pinata-issued JWT token with embedded scoped credentials

These are now part of git history and must be treated as **compromised**.

**Immediate actions:**
1. Rotate the Pinata API key and secret on the Pinata dashboard.
2. Regenerate the JWT secret to a random 32-byte value.
3. Add `backend/.env` to `.gitignore` and remove the file from git history with `git filter-repo` or `BFG Repo-Cleaner`.

---

## 5. Summary of Fixes by Priority

| # | ID | File | Description | Priority |
|---|----|------|-------------|----------|
| 1 | C-1 | `soroban.ts` | All contract calls pass empty args | 🔴 |
| 2 | C-2 | `soroban.ts` | No tx confirmation polling | 🔴 |
| 3 | F-1 | `App.tsx`, `ProductCard` | Missing product detail + buy flow | 🔴 |
| 4 | F-2 | `ListProduct.tsx` | `activateProduct` never called | 🔴 |
| 5 | F-3 | `AuthPage.tsx` | Wrong role used for redirect | 🔴 |
| 6 | F-4 | `walletStore.ts` | Session lost on refresh | 🔴 |
| 7 | S-1 | `backend/.env` | Live secrets in git | 🔴 |
| 8 | B-2 | `orders.ts` | No party-auth on mutations | 🟠 |
| 9 | B-3 | `auth.ts` | Login accepts public key without signature | 🟠 |
| 10 | C-7 | `escrow/lib.rs` | Config in instance storage (can expire) | 🟠 |
| 11 | C-3 | `soroban.ts` | Hardcoded account in `getProduct` | 🔴 |
| 12 | B-1 | `orders.ts` | No on-chain fund step wired up | 🔴 |
| 13 | C-4 | `marketplace/lib.rs` | `update_product` skips validation | 🟡 |
| 14 | C-5 | `escrow/lib.rs` | Escrow never calls `mark_sold` | 🟡 |
| 15 | C-6 | `registry/lib.rs` | No `activate_user` function | 🟡 |
| 16 | B-4 | `products.ts`, `orders.ts` | Missing try/catch on routes | 🟡 |
| 17 | B-5 | `products.ts`, `orders.ts` | Silent success on 0-row updates | 🟡 |
| 18 | B-6 | `orders.ts` | Partial payout sets wrong status | 🟡 |
| 19 | B-7 | `schema.sql` | Missing CHECK on `orders.status` | 🟢 |
| 20 | F-5 | `useProducts.ts` | `params` missing from effect deps | 🟡 |
| 21 | F-6 | `FarmerDashboard.tsx` | Client-side product filter wasteful | 🟡 |
| 22 | F-7 | `ProductCard.tsx` | Missing IPFS image error fallback | 🟢 |

---

## Recommended Implementation Order

1. ✅ **S-1** — Secrets sanitized from `backend/.env`; rotate Pinata keys on dashboard.
2. ✅ **C-1 + C-2** — `soroban.ts` rewritten: all args encoded as proper XDR ScVals; tx polling added.
3. ✅ **C-3** — Hardcoded account removed; `getProduct` now accepts `callerKey`.
4. ✅ **F-1** — `ProductDetail.tsx` created; route `/marketplace/:id` added to `App.tsx`.
5. ✅ **F-2** — `ListProduct.tsx` now calls `activateProduct` with `onChainId` + `txHash`.
6. ✅ **F-3** — `AuthPage.tsx` uses server-returned role for redirect (not local state default).
7. ✅ **F-4** — `walletStore.ts` uses `zustand/persist`; token expiry checked on rehydration.
8. ✅ **B-2** — All order mutation endpoints (`/fund`, `/ship`, `/complete`, `/dispute`) verify the caller is the correct party.
9. ✅ **B-3** — `GET /auth/challenge` added; `POST /auth/login` + `register` verify Ed25519 signature.
10. ✅ **B-4** — All backend routes wrapped in `try/catch` with proper 500 responses.
11. ✅ **B-5** — `rowCount` checked on UPDATE operations; returns 404/409 on misses.
12. ✅ **B-6** — Dispute resolve maps partial BPS to `'resolved'` (not `'completed'`).
13. ✅ **B-7** — `CHECK` constraints added for `orders.status` and `disputes.status`; `delivery_address` and `tx_hash` columns added to schema.
14. ✅ **C-4** — `update_product` in marketplace contract validates `price > 0` and `quantity > 0`.
15. ✅ **C-6** — `activate_user` added to registry contract.
16. ✅ **F-5** — `useProducts` effect uses `paramsKey` (JSON-stringified) in deps array.
17. ✅ **F-6** — `FarmerDashboard` passes `{ farmer: publicKey }` to `useProducts` for server-side filter.
18. ✅ **F-7** — `ProductCard` uses inline SVG fallback image with `onError` handler.
19. ⚠️ **C-5** — Escrow→marketplace cross-contract `mark_sold` call still pending (requires Marketplace contract address stored in Escrow init).
20. ⚠️ **C-7** — Admin/Token keys still in `instance` storage (TTL risk on long-lived contracts); recommend migrating to `persistent` storage before mainnet.
