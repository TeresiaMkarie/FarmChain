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
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('created','funded','shipped','completed','disputed','refunded','resolved'));

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
