-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_key    TEXT UNIQUE NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('Farmer', 'Buyer', 'Admin')),
  name          TEXT NOT NULL,
  phone         TEXT,
  location      TEXT,
  kyc_status    TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','verified','rejected')),
  chain_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  suspended_at      TIMESTAMPTZ,
  suspension_reason TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  on_chain_id   BIGINT,
  farmer_pk     TEXT NOT NULL REFERENCES users(public_key),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('grain','vegetable','fruit','dairy','livestock')),
  quantity      BIGINT NOT NULL,
  unit          TEXT NOT NULL CHECK (unit IN ('kg','ton','piece','liter')),
  price_xlm     BIGINT NOT NULL,  -- stroops
  image_cids    TEXT[] DEFAULT '{}',
  metadata_hash TEXT,
  tx_hash       TEXT,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','sold','cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id),
  on_chain_order_id BIGINT,
  escrow_id         TEXT,
  farmer_pk         TEXT NOT NULL,
  buyer_pk          TEXT NOT NULL,
  amount            BIGINT NOT NULL,  -- stroops
  delivery_address  TEXT,
  status            TEXT NOT NULL DEFAULT 'created'
                      CHECK (status IN ('created','funded','shipped','completed','disputed','refunded','resolved','cancelled')),
  tracking_hash     TEXT,
  tracking_info     TEXT,
  tx_hash           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Disputes
CREATE TABLE IF NOT EXISTS disputes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id),
  raised_by   TEXT NOT NULL,
  reason      TEXT,
  evidence    TEXT[],
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- P1: Indexes for dashboard query performance
CREATE INDEX IF NOT EXISTS idx_orders_farmer_pk   ON orders(farmer_pk);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_pk    ON orders(buyer_pk);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
CREATE INDEX IF NOT EXISTS idx_products_farmer_pk ON products(farmer_pk);
CREATE INDEX IF NOT EXISTS idx_products_status    ON products(status);

-- Receipts
CREATE TABLE IF NOT EXISTS receipts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id),
  ipfs_cid   TEXT,
  tx_hash    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- F8: Wishlist
CREATE TABLE IF NOT EXISTS wishlists (
  buyer_pk   TEXT NOT NULL REFERENCES users(public_key) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (buyer_pk, product_id)
);

-- F11: Farmer-to-buyer messages per order
CREATE TABLE IF NOT EXISTS messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_pk  TEXT NOT NULL REFERENCES users(public_key),
  body       TEXT NOT NULL CHECK (char_length(body) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_order_id ON messages(order_id);

-- F9: Recurring orders
CREATE TABLE IF NOT EXISTS recurring_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_pk         TEXT NOT NULL REFERENCES users(public_key) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id),
  quantity         INTEGER NOT NULL DEFAULT 1,
  delivery_address TEXT NOT NULL,
  frequency        TEXT NOT NULL CHECK (frequency IN ('weekly','fortnightly','monthly')),
  next_due_at      TIMESTAMPTZ NOT NULL,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recurring_buyer ON recurring_orders(buyer_pk);

-- F1: In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pk    TEXT NOT NULL REFERENCES users(public_key) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}',
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_pk ON notifications(user_pk);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_pk, read) WHERE read = FALSE;

-- F2: Product reviews (one review per completed order)
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id),
  product_id UUID NOT NULL REFERENCES products(id),
  buyer_pk   TEXT NOT NULL REFERENCES users(public_key),
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT CHECK (char_length(comment) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);
