import { Router, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

function adminOnly(req: AuthRequest, res: Response): boolean {
  if (req.user!.role !== 'Admin') {
    res.status(403).json({ error: 'Admin only' });
    return false;
  }
  return true;
}

// GET /admin/stats  — platform overview
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!adminOnly(req, res)) return;
  try {
    const [users, orders, disputes, gmv] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total, role FROM users GROUP BY role`),
      pool.query(`SELECT COUNT(*) AS total, status FROM orders GROUP BY status`),
      pool.query(`SELECT COUNT(*) AS total, status FROM disputes GROUP BY status`),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS gmv FROM orders WHERE status = 'completed'`),
    ]);
    res.json({
      users: users.rows,
      orders: orders.rows,
      disputes: disputes.rows,
      gmvStroops: gmv.rows[0].gmv,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /admin/disputes  — all disputes with order + product info
router.get('/disputes', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!adminOnly(req, res)) return;
  const limit = Math.min(parseInt(req.query.limit as string ?? '20', 10), 100);
  const offset = parseInt(req.query.offset as string ?? '0', 10);
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'open';
  try {
    const result = await pool.query(
      `SELECT d.*, o.buyer_pk, o.farmer_pk, o.amount, o.product_id,
              p.name AS product_name, ub.name AS buyer_name, uf.name AS farmer_name
       FROM disputes d
       JOIN orders o ON d.order_id = o.id
       LEFT JOIN products p ON o.product_id = p.id
       LEFT JOIN users ub ON o.buyer_pk = ub.public_key
       LEFT JOIN users uf ON o.farmer_pk = uf.public_key
       WHERE d.status = $1
       ORDER BY d.created_at ASC
       LIMIT $2 OFFSET $3`,
      [statusFilter, limit, offset],
    );
    const count = await pool.query(
      `SELECT COUNT(*) AS total FROM disputes WHERE status = $1`,
      [statusFilter],
    );
    res.json({ disputes: result.rows, total: parseInt(count.rows[0].total, 10) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// GET /admin/users  — all users, searchable
router.get('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!adminOnly(req, res)) return;
  const limit = Math.min(parseInt(req.query.limit as string ?? '20', 10), 100);
  const offset = parseInt(req.query.offset as string ?? '0', 10);
  const search = typeof req.query.search === 'string' ? `%${req.query.search}%` : null;
  try {
    const result = search
      ? await pool.query(
          `SELECT public_key, name, role, kyc_status, chain_verified, suspended_at, suspension_reason, created_at
           FROM users WHERE name ILIKE $1 OR public_key ILIKE $1
           ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
          [search, limit, offset],
        )
      : await pool.query(
          `SELECT public_key, name, role, kyc_status, chain_verified, suspended_at, suspension_reason, created_at
           FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset],
        );
    const count = search
      ? await pool.query(`SELECT COUNT(*) AS total FROM users WHERE name ILIKE $1 OR public_key ILIKE $1`, [search])
      : await pool.query(`SELECT COUNT(*) AS total FROM users`);
    res.json({ users: result.rows, total: parseInt(count.rows[0].total, 10) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /admin/users/:publicKey/suspend  — suspend or unsuspend a user
router.patch('/users/:publicKey/suspend', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!adminOnly(req, res)) return;
  const { reason, suspend } = req.body;
  try {
    await pool.query(
      `UPDATE users SET
         suspended_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
         suspension_reason = CASE WHEN $1 THEN $2 ELSE NULL END
       WHERE public_key = $3`,
      [suspend !== false, reason ?? null, req.params.publicKey],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to update suspension' });
  }
});

// PATCH /admin/users/:publicKey/verify  — chain-verify a farmer
router.patch('/users/:publicKey/verify', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!adminOnly(req, res)) return;
  try {
    await pool.query(
      `UPDATE users SET chain_verified = TRUE, kyc_status = 'verified' WHERE public_key = $1`,
      [req.params.publicKey],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

export default router;
