-- Run these statements against an EXISTING database to bring it up to the
-- current schema without wiping data.  Skip any statement that fails with
-- "already exists" — it means the column/constraint is already in place.

-- Add on_chain_id column to products (Soroban marketplace product ID)
ALTER TABLE products ADD COLUMN IF NOT EXISTS on_chain_id BIGINT;

-- Add tx_hash column to products (used by activate endpoint)
ALTER TABLE products ADD COLUMN IF NOT EXISTS tx_hash TEXT;

-- Add delivery_address column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- Add CHECK constraint to orders.status (PostgreSQL 12+)
-- Note: existing rows with non-conforming values will cause this to fail.
-- Clean them up first if needed: UPDATE orders SET status='created' WHERE status NOT IN (...)
-- Drop old constraint (may not include 'cancelled') and replace with correct one
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('created','funded','shipped','completed','disputed','refunded','resolved','cancelled'));

-- Add CHECK constraint to disputes.status
ALTER TABLE disputes
  ADD CONSTRAINT disputes_status_check
  CHECK (status IN ('open','resolved'));

-- Extend users table with profile fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS email               TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country             TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS county              TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city                TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude            DECIMAL(10,8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude           DECIMAL(11,8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_wallet       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency  TEXT NOT NULL DEFAULT 'XLM';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language  TEXT NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();

-- Notification preferences (1:1 with users)
CREATE TABLE IF NOT EXISTS user_notifications (
  public_key        TEXT PRIMARY KEY REFERENCES users(public_key) ON DELETE CASCADE,
  txn_inapp         BOOLEAN NOT NULL DEFAULT TRUE,
  txn_email         BOOLEAN NOT NULL DEFAULT TRUE,
  txn_sms           BOOLEAN NOT NULL DEFAULT FALSE,
  wallet_inapp      BOOLEAN NOT NULL DEFAULT TRUE,
  wallet_email      BOOLEAN NOT NULL DEFAULT FALSE,
  wallet_sms        BOOLEAN NOT NULL DEFAULT FALSE,
  marketplace_inapp BOOLEAN NOT NULL DEFAULT TRUE,
  marketplace_email BOOLEAN NOT NULL DEFAULT TRUE,
  marketplace_sms   BOOLEAN NOT NULL DEFAULT FALSE,
  payment_inapp     BOOLEAN NOT NULL DEFAULT TRUE,
  payment_email     BOOLEAN NOT NULL DEFAULT TRUE,
  payment_sms       BOOLEAN NOT NULL DEFAULT TRUE,
  dispute_inapp     BOOLEAN NOT NULL DEFAULT TRUE,
  dispute_email     BOOLEAN NOT NULL DEFAULT TRUE,
  dispute_sms       BOOLEAN NOT NULL DEFAULT TRUE,
  promo_inapp       BOOLEAN NOT NULL DEFAULT FALSE,
  promo_email       BOOLEAN NOT NULL DEFAULT FALSE,
  promo_sms         BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Add quantity column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

-- Sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_key   TEXT NOT NULL REFERENCES users(public_key) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  user_agent   TEXT,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked      BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sessions_public_key ON user_sessions(public_key);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON user_sessions(token_hash);

-- F8: Wishlist
CREATE TABLE IF NOT EXISTS wishlists (
  buyer_pk   TEXT NOT NULL REFERENCES users(public_key) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (buyer_pk, product_id)
);

-- F11: Order messages (farmer ↔ buyer thread per order)
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
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_pk        TEXT NOT NULL REFERENCES users(public_key) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  quantity        INTEGER NOT NULL DEFAULT 1,
  delivery_address TEXT NOT NULL,
  frequency       TEXT NOT NULL CHECK (frequency IN ('weekly','fortnightly','monthly')),
  next_due_at     TIMESTAMPTZ NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recurring_buyer ON recurring_orders(buyer_pk);

-- F7: Farmer bio and farm images
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_images TEXT[];

-- F4: Delivery date scheduling on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- F5: Harvest date and freshness on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS harvested_at     DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS best_before_days INT;

-- F1: Notifications table
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

-- F2: Reviews table
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

-- P1: Indexes on high-query columns to avoid full table scans on dashboard loads
CREATE INDEX IF NOT EXISTS idx_orders_farmer_pk  ON orders(farmer_pk);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_pk   ON orders(buyer_pk);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_products_farmer_pk ON products(farmer_pk);
CREATE INDEX IF NOT EXISTS idx_products_status   ON products(status);

-- A2: User suspension mechanism
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at       TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason  TEXT;
