# Farmer Dashboard v2 — Design & Feature Spec

## Problem Statement

The current dashboard gives a farmer three numbers (active listings, total orders, earnings) and two read-only tables. A farmer cannot act on anything from the dashboard — they cannot ship an order, edit a product, respond to a dispute, or know what needs attention right now. The goal of v2 is to make the dashboard the farmer's primary work surface, not a status report.

---

## Guiding Principle

**Surface the right action at the right time.** Every section of the dashboard should answer: *"What do I need to do next?"* Passive data (charts, stats) is secondary. Actionable items come first.

---

## Feature Areas

### 1. Action Inbox (Priority: P0)

**What it is:** A pinned section at the top of the dashboard listing everything that needs the farmer's attention right now — new unfulfilled orders, disputes raised, products that went pending but were never activated.

**Why it matters:** Currently, a farmer has to scan the entire orders table to find out what needs action. With 20+ orders this becomes unworkable.

**Items that appear in the inbox:**
| Trigger | Card text | Action button |
|---|---|---|
| Order status = `funded` | "New order — {buyer short address} bought {qty}× {product name}" | Mark Shipped |
| Order status = `disputed` | "Dispute on order #{id} — {reason excerpt}" | View Dispute |
| Product status = `pending` | "{product name} is not yet live on-chain" | Activate |
| Order status = `shipped` > 7 days | "Order #{id} shipped 7+ days ago — follow up?" | View Order |

**Implementation:**
- Frontend: filter `orders` and `products` already fetched by the dashboard; no new API calls
- Display as a card list with a coloured left border (orange = pending action, red = dispute, yellow = warning)
- Dismiss a card by taking the action; cards vanish when state changes

---

### 2. Quick-Ship Modal (Priority: P0)

**What it is:** An inline modal on each `funded` order card/row that lets the farmer enter tracking info and mark the order shipped without leaving the dashboard.

**Why it matters:** Today, marking an order as shipped requires navigating to `/orders/:id`, which means the farmer loses context. The ship action is simple — it only needs a tracking number.

**Fields:**
- Tracking number (text, optional)
- Carrier (dropdown: General / Courier / Truck — plain text, no integration needed)
- Note to buyer (textarea, optional, stored in `tracking_info`)

**Implementation:**
- Frontend: reuse the existing `shipOrder` API call (`POST /orders/:id/ship`)
- Modal opens from the inbox card and from the orders table row
- On success, re-fetch orders and update the inbox

---

### 3. Product Management — Edit & Inventory (Priority: P0)

**What it is:** Inline editing of price and quantity for existing listings, plus auto-decrement of quantity when an order is placed.

**Why it matters:** Prices change seasonally. A farmer with 100 kg of maize who sells 20 kg needs the listing to reflect 80 kg — today they have to delist and re-list.

**Features:**
- Edit button on each product row opens an inline form for: price (XLM), quantity, description
- Separate endpoint on backend: `PATCH /products/:id` (price, quantity, description only — name/category cannot change after on-chain listing)
- Auto-decrement: when `POST /orders` creates an order, backend subtracts `order.quantity` from `product.quantity`; if quantity reaches 0, status auto-flips to `sold`
- Low stock badge: if `quantity <= 10% of original` show a yellow "Low stock" badge on the row

**Backend changes needed:**
```
PATCH /products/:id
  body: { priceXlm?, quantity?, description? }
  auth: farmer-only, must own product
  converts priceXlm to stroops before update
```

```sql
-- In orders POST handler (already exists at backend/src/routes/orders.ts):
UPDATE products SET quantity = quantity - $1 WHERE id = $2
```

---

### 4. Earnings & Financials Panel (Priority: P0)

**What it is:** A breakdown of money earned, money in escrow, and money pending — replacing the single "Earnings (XLM)" number.

**Why it matters:** "Earnings" currently only counts completed orders. A farmer with 5 funded orders sitting in escrow has no visibility into that money.

**Three numbers displayed:**
| Label | Source | Color |
|---|---|---|
| Completed earnings | `sum(amount)` where `status = completed` | Green |
| In escrow (funded/shipped) | `sum(amount)` where `status IN (funded, shipped)` | Blue |
| Disputed / at risk | `sum(amount)` where `status = disputed` | Red |

**All amounts shown in XLM** (divide stroops by 10,000,000).

**Implementation:** Pure frontend computation on the already-fetched `orders` array. No new API call.

---

### 5. Products Table — Full Actions (Priority: P1)

**What it is:** Every product row gets a set of action buttons: Edit, Delist, and (if pending) Activate.

**Current state:** The table is read-only. There is a `DELETE /products/:id` endpoint and a `PATCH /products/:id/activate` endpoint that are not surfaced in the dashboard.

**Row actions:**
| Product status | Actions shown |
|---|---|
| `pending` | Activate, Delist |
| `active` | Edit, Delist |
| `sold` | Re-list (clone as new pending product) |
| `cancelled` | Re-list |

**Re-list flow:** Clicking Re-list pre-fills the ListProduct form with the old product's data. No new backend route needed — it uses `POST /products` to create a fresh record.

---

### 6. Orders Table — Status-Aware Rows (Priority: P1)

**What it is:** Each order row shows a contextual action button instead of just a "View" link.

**Mapping:**
| Order status | Row action |
|---|---|
| `funded` | Ship (opens quick-ship modal) |
| `shipped` | View |
| `disputed` | Respond (opens dispute detail) |
| `completed` | View Receipt |
| `refunded` / `resolved` | View |

---

### 7. Dispute Management (Priority: P1)

**What it is:** A dedicated "Disputes" section on the dashboard showing all open disputes with the reason, the order it relates to, and who raised it.

**Why it matters:** Disputes currently require navigating to `/orders/:id` and have no dedicated farmer UI.

**Information shown per dispute:**
- Order ID (short)
- Product name
- Buyer short address
- Dispute reason
- Date raised
- Status (open / resolved)

**Actions:** View full order detail (link). No in-app dispute resolution for the farmer — resolution is admin-only by design (on-chain escrow arbitration).

**Backend:** `GET /disputes?farmer=<pk>` — new endpoint needed.

```sql
SELECT d.*, o.product_id, o.buyer_pk, o.amount
FROM disputes d
JOIN orders o ON d.order_id = o.id
WHERE o.farmer_pk = $1
ORDER BY d.created_at DESC
```

---

### 8. Notifications (Priority: P1)

**What it is:** In-app notification bell with an unread count badge showing events since last login.

**Events tracked:**
- New order placed on one of your products
- Order funded (money in escrow)
- Dispute raised
- Dispute resolved

**Implementation (no WebSocket needed for v1):**
- Poll `GET /notifications?unread=true` on dashboard mount and every 60 seconds
- Backend: new `notifications` table (id, user_pk, type, order_id, read, created_at)
- Backend writes a notification row in the existing order route handlers (no external service)
- Mark all read when the bell is clicked

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pk TEXT NOT NULL REFERENCES users(public_key),
  type TEXT NOT NULL, -- 'new_order' | 'order_funded' | 'dispute_raised' | 'dispute_resolved'
  order_id UUID REFERENCES orders(id),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 9. Farm Profile Card (Priority: P2)

**What it is:** A card on the dashboard showing the farmer's public profile — name, location, member since, and a link to edit their profile.

**Why it matters:** Buyers see this info on product detail pages. Farmers should be able to update their name, phone, and location without going to a separate settings page.

**Fields editable inline:**
- Display name
- Location (city/region)
- Phone number

**Backend:** `PATCH /users/me` — new endpoint needed.

---

### 10. Product Performance Insights (Priority: P2)

**What it is:** A small analytics card per product showing: total orders, total revenue, and units sold.

**Why it matters:** A farmer with 10 active listings needs to know which ones are selling to focus restocking effort.

**Implementation:**
- Backend aggregation endpoint: `GET /products/:id/stats`
  ```sql
  SELECT COUNT(*) AS order_count,
         SUM(amount) AS total_revenue,
         SUM(o.quantity) AS units_sold   -- requires adding quantity column to orders
  FROM orders o
  WHERE o.product_id = $1 AND o.status = 'completed'
  ```
- Frontend: lazy-load stats when user expands a product row

---

## Layout Redesign

```
┌─────────────────────────────────────────────────────┐
│  Farmer Dashboard          [+ List Product]          │
│  GABC…XYZ  •  Verified ✓                            │
├──────────────┬──────────────┬────────────────────────┤
│  Completed   │  In Escrow   │  Disputed / At Risk    │
│  42.50 XLM   │  12.00 XLM   │  0.00 XLM              │
├──────────────┴──────────────┴────────────────────────┤
│  ⚡ Action Inbox  (3 items)                           │
│  ┌────────────────────────────────────────────────┐  │
│  │ 🟠 New order — GBUY…123 bought 50 kg Maize  [Ship]│
│  │ 🟠 Maize Organic is not yet live on-chain [Activate]│
│  │ 🔴 Dispute on order #a3f2 — item not received [View]│
│  └────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  My Listings                                         │
│  [Product table with Edit / Delist / Activate rows]  │
├─────────────────────────────────────────────────────┤
│  Incoming Orders                                     │
│  [Orders table with contextual Ship/View actions]    │
├─────────────────────────────────────────────────────┤
│  Open Disputes  (if any)                             │
│  [Disputes table — only shown when disputes exist]   │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1 — No new backend routes (pure frontend, ~1–2 days)

| Task | File(s) |
|---|---|
| Action Inbox section | `FarmerDashboard.tsx` |
| Earnings breakdown (3 numbers) | `FarmerDashboard.tsx` |
| Quick-Ship modal | new `ShipOrderModal.tsx` |
| Products table action buttons (Delist, wire Activate) | `FarmerDashboard.tsx` |
| Orders table contextual actions | `FarmerDashboard.tsx` |

### Phase 2 — New backend routes (2–3 days)

| Task | File(s) |
|---|---|
| `PATCH /products/:id` (edit price/qty/desc) | `backend/src/routes/products.ts` |
| Auto-decrement quantity on order create | `backend/src/routes/orders.ts` |
| `GET /disputes?farmer=<pk>` | new `backend/src/routes/disputes.ts` |
| `PATCH /users/me` (profile edit) | `backend/src/routes/users.ts` |
| Disputes section on dashboard | `FarmerDashboard.tsx` |
| Farm profile card | new `FarmProfileCard.tsx` |

### Phase 3 — Notifications (3–4 days)

| Task | File(s) |
|---|---|
| `notifications` table migration | `backend/src/db/migrate.sql` |
| Write notifications in order handlers | `backend/src/routes/orders.ts` |
| `GET /notifications` + `PATCH /notifications/read` | new `backend/src/routes/notifications.ts` |
| Notification bell UI | new `NotificationBell.tsx`, `Navbar.tsx` |

### Phase 4 — Analytics (2 days)

| Task | File(s) |
|---|---|
| `GET /products/:id/stats` | `backend/src/routes/products.ts` |
| Add `quantity` column to `orders` table | `backend/src/db/migrate.sql` |
| Product performance row expansion | `FarmerDashboard.tsx` |

---

## What We Are NOT Building

- External shipping carrier integrations (too complex, not core)
- Buyer ratings/reviews (requires moderation infrastructure)
- Real-time WebSocket notifications (polling every 60s is sufficient for v1)
- SMS/email alerts (requires third-party service setup)
- Multi-farm accounts (one public key = one farm by design)

---

## Files That Will Change

| File | Change type |
|---|---|
| `frontend/src/pages/FarmerDashboard.tsx` | Major rewrite |
| `frontend/src/components/farmer/ShipOrderModal.tsx` | New |
| `frontend/src/components/farmer/EditProductModal.tsx` | New |
| `frontend/src/components/farmer/FarmProfileCard.tsx` | New |
| `frontend/src/components/farmer/NotificationBell.tsx` | New |
| `frontend/src/hooks/useDisputes.ts` | New |
| `frontend/src/hooks/useNotifications.ts` | New |
| `frontend/src/lib/api.ts` | Add dispute/notification/edit calls |
| `backend/src/routes/products.ts` | Add PATCH edit endpoint |
| `backend/src/routes/orders.ts` | Add quantity decrement |
| `backend/src/routes/users.ts` | Add PATCH /me |
| `backend/src/routes/disputes.ts` | New (farmer dispute list) |
| `backend/src/routes/notifications.ts` | New |
| `backend/src/db/migrate.sql` | notifications table, orders.quantity |
