# FarmChain — Buyer Experience: Current State & Improvement Plan

> Audited: 2026-06-06  
> Branch: `develop`  
> Scope: Everything a buyer touches — auth, marketplace, checkout, order lifecycle, disputes

---

## 1. Current State

### What works today

| Area | Status |
|------|--------|
| Register / login as Buyer via Freighter + challenge-response auth | ✅ Done |
| Browse active products with search + category filter | ✅ Done |
| View product detail (price, quantity, farmer name, location, image) | ✅ Done |
| Place an order — 2-step: DB record + Soroban escrow lock | ✅ Done |
| View own orders in BuyerDashboard (total, active, spent) | ✅ Done |
| Order detail page with status badge | ✅ Done |
| Confirm delivery → releases escrow funds to farmer | ✅ Done |
| Raise a dispute on funded/shipped order | ✅ Done |
| Persist wallet session across page refresh | ✅ Done |

### What is already broken / partially broken (ref `BUGS_AND_IMPROVEMENTS.md`)

These are pre-conditions for a working buyer flow and must be fixed before new features are layered on:

| Ref | Issue | Impact on Buyer |
|-----|-------|----------------|
| C-5 | Escrow never calls `mark_sold` on marketplace contract | Products show "active" even after fully purchased; buyers see phantom stock |
| C-7 | Admin/Token in `instance` storage (expires on long-running network) | Escrow becomes inoperable; all purchases fail silently |
| B-1 | `delivery_address` accepted by backend but never passed from the UI | Farmer has no address to ship to |

---

## 2. Gaps in the Buyer Journey

These are gaps where the code compiles and runs but the buyer experience is incomplete, confusing, or broken in edge cases.

### 2.1 No Order Cancellation Before Funding

**Files:** `frontend/src/pages/ProductDetail.tsx`, `backend/src/routes/orders.ts`

When `handleBuy` creates the DB order (`status = 'created'`) and then the Soroban escrow call fails (network, insufficient balance, user rejection), the order is stuck in `created` state with `on_chain_order_id = null`. The buyer sees a phantom order in their dashboard with no way to cancel or retry.

**What to add:**
- `DELETE /orders/:id` backend endpoint — cancels a `created` order and restores product quantity.
- "Cancel Order" button on `OrderPage` visible to the buyer when `status === 'created'`.
- On `ProductDetail`, if escrow fails after DB creation, automatically attempt cancellation and show a clear retry button.

---

### 2.2 No Delivery Address in Checkout

**Files:** `frontend/src/pages/ProductDetail.tsx`, `backend/src/routes/orders.ts:47`

The `orders` table has a `delivery_address` column and the `POST /orders` endpoint accepts `deliveryAddress`, but `ProductDetail.tsx` never collects or sends it. Farmers receive orders with no idea where to deliver.

**What to add:**
- A `delivery_address` text input on `ProductDetail` before the Buy button (required field).
- Display the delivery address on `OrderPage` for both buyer and farmer.

---

### 2.3 No Dispute Reason or Evidence

**Files:** `frontend/src/pages/OrderPage.tsx:48-57`, `backend/src/routes/orders.ts:178-208`

The `disputes` table has `reason TEXT` and `evidence TEXT[]` columns. The backend's `POST /orders/:id/dispute` reads `req.body.reason` but `OrderPage.tsx` calls `disputeOrder(order.id, {})` — always passing an empty object.

**What to add:**
- A `<textarea>` for the dispute reason on `OrderPage` (visible when the "Raise Dispute" button is clicked).
- Optional evidence: an array of IPFS CIDs or freeform text links the buyer can attach.
- Pass `{ reason, evidence }` to `disputeOrder`.

---

### 2.4 Dispute Status is Opaque After Filing

**Files:** `frontend/src/pages/OrderPage.tsx`, `frontend/src/pages/BuyerDashboard.tsx`

Once a buyer raises a dispute, the order shows `disputed` status badge with no further context. There is no way for the buyer to:
- See the dispute record (reason they filed, current admin status).
- See the resolution or the split amount once resolved.

**What to add:**
- On `OrderPage`, when `status === 'disputed'`, fetch and display the linked dispute record: reason filed, admin resolution notes, and the final split (buyer vs. farmer amounts in XLM).
- `GET /disputes/:orderId` backend endpoint (or embed the dispute in `GET /orders/:id`).

---

### 2.5 No Order Timeline / Status History

**Files:** `frontend/src/pages/OrderPage.tsx`

`OrderPage` shows the current status but gives no history of how the order got there. A buyer who sees `shipped` has no timestamp for when funding happened or when it was marked shipped.

**What to add:**
- An `order_events` table (or reuse `updated_at` milestones) with entries like `{ event, at, actor }`.
- A vertical timeline component on `OrderPage` showing: Created → Funded → Shipped → Completed.

---

### 2.6 No Automatic Order Refresh on Status Change

**Files:** `frontend/src/hooks/useOrders.ts`, `frontend/src/pages/OrderPage.tsx`

`useOrder` fetches once on mount. If a farmer marks an order as shipped while the buyer has `OrderPage` open, the buyer sees no update until they hard-refresh.

**What to add (simplest first):**
- Poll `GET /orders/:id` every 15 seconds when the order is in a mutable state (`funded`, `shipped`, `disputed`).
- Long-term: move to WebSocket or SSE events from the backend.

---

### 2.7 No Price-Range or Sort in Marketplace

**File:** `frontend/src/pages/Marketplace.tsx`

The marketplace has a name search and category chips. A buyer looking for affordable grain has no way to sort by price or filter by max price.

**What to add:**
- Sort dropdown: Newest / Price: Low–High / Price: High–Low.
- Min/Max price inputs (in XLM) that filter client-side (data is already fetched).
- These are purely frontend additions — no backend change needed since all active products are already fetched.

---

### 2.8 Marketplace Missing Farmer Profile Link

**Files:** `frontend/src/components/marketplace/ProductCard.tsx`, `frontend/src/pages/ProductDetail.tsx`

Both pages show `farmerName` and `location` but neither links to a farmer profile. A buyer cannot assess a farmer's reputation.

**What to add:**
- `GET /users/:publicKey` already exists and returns `name, location, country, city, chain_verified, created_at`.
- A `/farmers/:publicKey` page showing the farmer's name, verification badge, location, and their active product listings.
- Link the farmer name on `ProductCard` and `ProductDetail` to this page.

---

### 2.9 No Order Quantity Shown in Dashboard or Detail

**Files:** `frontend/src/types/index.ts`, `backend/src/routes/orders.ts`

The `Order` type has no `quantity` field. The orders table has `amount` (in stroops) and references `product_id`, but the actual quantity ordered is not stored.

**What to add:**
- Add `quantity INTEGER NOT NULL DEFAULT 1` to the `orders` table.
- Persist it in `POST /orders`.
- Display `Quantity: 3 kg` on `OrderPage` and in the dashboard table next to the product name.

---

### 2.10 No Re-order ("Buy Again") Shortcut

**File:** `frontend/src/pages/OrderPage.tsx`

Completed orders have no shortcut to the product listing. Buyers who want to repurchase must navigate back to the marketplace and search again.

**What to add:**
- A "Buy Again" link on `OrderPage` when `status === 'completed'`, pointing to `/marketplace/${order.productId}`.
- If the product is no longer active (sold/cancelled), show a greyed-out "No longer available" note.

---

### 2.11 No Order Receipt

**Files:** `backend/src/routes/orders.ts:167-171`, frontend

The backend inserts a row in `receipts` on order completion, but the frontend never fetches or displays it. There is no confirmation email, no downloadable summary, and no in-app "receipt" view.

**What to add (MVP):**
- A `GET /receipts/:orderId` endpoint returning `{ orderId, productName, amount, farmerPk, txHash, completedAt }`.
- A "View Receipt" button on completed `OrderPage` that renders a printable/shareable receipt modal.

---

### 2.12 BuyerDashboard Table Not Mobile-Friendly

**File:** `frontend/src/pages/BuyerDashboard.tsx`

The 5-column order table (`Order ID`, `Product`, `Amount`, `Status`, `Action`) with `overflow-x-auto` is functional on desktop but collapses poorly on mobile.

**What to add:**
- On small screens (`sm:` and below), replace the table with a card list — each card shows product name, status badge, amount, and a "View" button.

---

### 2.13 No Pagination on BuyerDashboard

**File:** `frontend/src/pages/BuyerDashboard.tsx`, `backend/src/routes/orders.ts`

`GET /orders` returns all orders with no limit. A buyer with hundreds of orders loads them all on every visit.

**What to add:**
- `?limit=20&offset=0` query params on `GET /orders`.
- "Load more" or pagination controls on `BuyerDashboard`.

---

### 2.14 `delivered` Order Status is Defined but Never Used

**File:** `frontend/src/types/index.ts:29-36`

`OrderStatus` includes `'delivered'` but neither the escrow contract nor the backend ever sets this status. The flow goes `shipped → completed`. Either:
- Remove `delivered` from the type (it's dead code), or
- Introduce it as a meaningful step: buyer acknowledges receipt before on-chain `confirm_delivery` runs (useful for physical deliveries with a time gap).

**Recommendation:** Remove `delivered` from the type for now to avoid confusion, unless you want to add a 2-step confirmation UX (acknowledge → then sign on-chain).

---

### 2.15 `on_chain_order_id` Uses `Date.now()` — Collision Risk

**File:** `frontend/src/pages/ProductDetail.tsx:37`

```ts
const onChainOrderId = Date.now();
```

Two buyers purchasing within the same millisecond get the same `onChainOrderId`. The Soroban contract will reject the second one with `"order already exists"`, but the first buyer's DB record will already be created, leaving the second buyer's order orphaned in `created` state.

**Fix:**
- Generate a random `u64` instead: `Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)`.
- Or, better: let the backend generate the `onChainOrderId` and return it in `POST /orders`, so it can guarantee uniqueness.

---

## 3. Backend Gaps

### 3.1 No `quantity` on Orders

As noted in 2.9 — add `quantity` column, store it, and return it.

### 3.2 `GET /orders` Has No Status Filter

A buyer wanting to see only active orders must load all and filter client-side. Add `?status=funded,shipped` query param support.

### 3.3 No `GET /receipts/:orderId` Endpoint

Backend inserts receipts but exposes no read endpoint. Add it (auth required, party-check).

### 3.4 No `DELETE /orders/:id` (Cancel)

As noted in 2.1. Needs to:
1. Check `status === 'created'` (only unfunded orders can be cancelled).
2. Restore product `quantity`.
3. Set order `status = 'cancelled'`.

### 3.5 Dispute Record Not Embedded in Order Fetch

`GET /orders/:id` returns only the `orders` row. Add a `LEFT JOIN disputes` so the dispute record (reason, resolution) is included when `status = 'disputed'`.

---

## 4. Robustness Improvements

### 4.1 Optimistic UI Rollback on Escrow Failure

**File:** `frontend/src/pages/ProductDetail.tsx:31-63`

If `createOrderChain` fails (step 3), the DB order is already created (step 1) but not funded. The buyer's UI navigates away on success and shows an error toast on failure, but the orphan `created` order remains. 

**Pattern to adopt:**
```
1. Create DB order → get orderId
2. Try escrow call
   - On success → fundOrder in DB → navigate to order page
   - On failure → auto-cancel DB order → show error with "Try again" (which creates a fresh order)
```

### 4.2 Loading States on Action Buttons

**File:** `frontend/src/pages/OrderPage.tsx`

`handleConfirm` and `handleDispute` have no `loading` state. Buttons remain clickable while the Soroban transaction is signing/polling (up to 30 seconds). A double-click could fire two transactions.

**Fix:** Add `const [acting, setActing] = useState(false)` and `disabled={acting}` on all action buttons.

### 4.3 Wallet Balance Check Before Purchase

**File:** `frontend/src/pages/ProductDetail.tsx`

The buyer sees the total XLM but the UI never checks if they have enough balance. They'll click "Buy", Freighter will pop up, and then the transaction fails on-chain. 

**Fix:** Use `useBalance` hook (already exists at `hooks/useBalance.ts`) to fetch the live XLM balance. If `totalXlm > balance - 1` (leaving 1 XLM for fees), show a warning: "Insufficient balance. You have X XLM."

### 4.4 Escrow Transaction Timeout UX

**File:** `frontend/src/lib/soroban.ts:25-33`

`pollTransaction` times out after 30 seconds and throws. On `OrderPage`, the buyer just sees an error toast. There is no "your funds may still be locked" warning.

**Fix:** Catch timeout errors specifically and show: "Transaction timed out. Check your Stellar Explorer using tx hash `{txHash}` to verify if funds were locked."

### 4.5 Product Quantity Race Condition

**File:** `frontend/src/pages/ProductDetail.tsx:135-143`

`max={product.quantity}` is set at page load. If product quantity changes between load and submit (another buyer purchased some), the backend will reject with `409 Insufficient product quantity`. The UI currently shows only the generic toast error message.

**Fix:** Catch the 409 specifically and show: "Only X units are now available" — then refresh the product data.

---

## 5. Feature Improvements (Phase 2)

These are valuable but not required for a working MVP.

### 5.1 Buyer Rating / Review After Completion

After `status = 'completed'`, allow the buyer to leave a 1–5 star rating and optional comment for the farmer. Store in a new `reviews` table. Display aggregate rating on the farmer profile and `ProductCard`.

**New backend:** `POST /reviews` (auth, buyer only, once per order), `GET /reviews?farmerPk=...`.  
**New frontend:** Review form on `OrderPage` after completion, star display on `ProductCard`.

### 5.2 Favorites / Saved Products

A buyer can bookmark products they're interested in. Persist as `saved_products(public_key, product_id)` in the DB.

**New backend:** `POST /users/me/saved`, `DELETE /users/me/saved/:productId`, `GET /users/me/saved`.  
**New frontend:** Heart icon on `ProductCard`, "Saved" tab on `BuyerDashboard`.

### 5.3 Marketplace Product Comparison

Allow buyers to select up to 3 products and compare them side-by-side (price, quantity, location, farmer rating). Entirely frontend — no backend changes.

### 5.4 Smart Notifications (Actual Dispatch)

The notification preferences settings exist and are stored (email, SMS, in-app toggles per category). Wire them to actual events:
- Farmer marks shipped → push in-app notification + email to buyer.
- Dispute resolution → notify both parties.
- Order completed → send receipt to buyer's email.

**Requires:** an email/SMS provider (SendGrid, Twilio) and a backend notification worker/job.

### 5.5 Multi-Item Cart

Currently each purchase is a single product + quantity. A cart would let buyers add multiple farmer products and check out together. This is a larger architectural change:
- One "cart session" maps to multiple escrow transactions (one per farmer, since each escrow is farmer-specific).
- Alternatively, batch all items from the same farmer into a single escrow call.

---

## 6. Implementation Roadmap

### Phase 1 — Fix & Harden (Critical, ~1 week)

These are pre-conditions for a trustworthy buyer experience.

| # | Task | Files | Effort |
|---|------|-------|--------|
| 1.1 | Add `quantity` to orders table + `POST /orders` + `Order` type | `schema.sql`, `orders.ts`, `types/index.ts` | S |
| 1.2 | Add delivery address input to `ProductDetail` + display on `OrderPage` | `ProductDetail.tsx`, `OrderPage.tsx` | S |
| 1.3 | Auto-cancel orphan DB order on escrow failure in `ProductDetail` | `ProductDetail.tsx`, `orders.ts` (DELETE endpoint) | M |
| 1.4 | Fix `onChainOrderId` collision risk — use random u64 | `ProductDetail.tsx` | XS |
| 1.5 | Disable action buttons while Soroban tx is in-flight (`OrderPage`) | `OrderPage.tsx` | XS |
| 1.6 | Add dispute reason textarea to `OrderPage` | `OrderPage.tsx` | S |
| 1.7 | Remove dead `delivered` status from `OrderStatus` type (or implement it) | `types/index.ts` | XS |
| 1.8 | Balance check before buy button in `ProductDetail` | `ProductDetail.tsx`, `useBalance.ts` | S |

### Phase 2 — Enrich (Core UX, ~2 weeks)

| # | Task | Files | Effort |
|---|------|-------|--------|
| 2.1 | Dispute detail on `OrderPage` (reason + resolution + split) | `OrderPage.tsx`, `orders.ts` (JOIN dispute) | M |
| 2.2 | Order status timeline component | new `OrderTimeline.tsx`, `OrderPage.tsx` | M |
| 2.3 | Auto-refresh order status when in mutable states | `useOrders.ts` | S |
| 2.4 | Price sort + price-range filter on Marketplace | `Marketplace.tsx` | S |
| 2.5 | Farmer profile page | new `FarmerProfile.tsx`, route in `App.tsx` | M |
| 2.6 | Mobile card view for BuyerDashboard | `BuyerDashboard.tsx` | S |
| 2.7 | Order receipt modal + `GET /receipts/:orderId` | `OrderPage.tsx`, new backend endpoint | M |
| 2.8 | "Buy Again" shortcut on completed orders | `OrderPage.tsx` | XS |
| 2.9 | Pagination on `GET /orders` + dashboard load-more | `orders.ts`, `BuyerDashboard.tsx` | M |
| 2.10 | Status filter tabs on `BuyerDashboard` | `BuyerDashboard.tsx` | S |

### Phase 3 — Differentiate (Product, ~3 weeks)

| # | Task | Files | Effort |
|---|------|-------|--------|
| 3.1 | Buyer ratings & reviews | new `reviews.ts` route, new `ReviewForm.tsx`, `ProductCard.tsx` update | L |
| 3.2 | Saved products / favorites | new `saved_products` table, new API endpoints, `BuyerDashboard.tsx` tab | L |
| 3.3 | Real notification dispatch (email/in-app) | backend event hooks, email provider | XL |
| 3.4 | Product comparison UI | new `CompareBar.tsx`, `Marketplace.tsx` changes | L |
| 3.5 | Multi-item cart | schema changes, multiple escrow calls, new `Cart.tsx` | XL |

---

## 7. File Change Map

> Quick reference for where each improvement lives.

```
frontend/
  src/
    pages/
      ProductDetail.tsx     — delivery address, balance check, onChainOrderId fix,
                              auto-cancel on escrow failure, 409 UX
      OrderPage.tsx         — disable buttons while acting, dispute reason,
                              dispute detail, status timeline, buy-again link,
                              receipt modal, auto-refresh
      BuyerDashboard.tsx    — status filter tabs, mobile card view, pagination,
                              saved products tab
      Marketplace.tsx       — price sort, price-range filter
      FarmerProfile.tsx     — NEW: farmer detail page
    components/
      marketplace/
        ProductCard.tsx     — farmer name as link
      shared/
        OrderTimeline.tsx   — NEW: order event history
        ReceiptModal.tsx    — NEW: printable receipt
    hooks/
      useOrders.ts          — auto-refresh, pagination, status filter param
    types/
      index.ts              — add quantity to Order, remove/define delivered status

backend/
  src/
    routes/
      orders.ts             — DELETE /:id (cancel), GET adds dispute JOIN,
                              quantity stored, status/limit/offset query params
      receipts.ts           — NEW: GET /receipts/:orderId
      reviews.ts            — NEW: CRUD reviews (Phase 3)
    db/
      schema.sql            — orders.quantity column, reviews table,
                              saved_products table
```

---

## 8. Design Principles to Maintain

1. **Every buyer action that touches the blockchain must show a pending state** — users cannot predict Soroban tx latency.
2. **Never leave an orphan DB record** — if the on-chain step fails, roll back the DB record automatically.
3. **Buyer should never need to understand XDR or Soroban** — all blockchain complexity is hidden behind friendly status messages and toast notifications.
4. **Escrow state is the source of truth** — if the DB and the on-chain state disagree, show the on-chain state (or flag the discrepancy to the buyer with a "sync" button).
5. **Mobile-first for buyers** — many buyers in target markets (East Africa) will be on mobile. Test all buyer flows at 375px width.
