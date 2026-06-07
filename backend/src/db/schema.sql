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
