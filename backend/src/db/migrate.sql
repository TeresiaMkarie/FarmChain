-- Run these statements against an EXISTING database to bring it up to the
-- current schema without wiping data.  Skip any statement that fails with
-- "already exists" — it means the column/constraint is already in place.

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
