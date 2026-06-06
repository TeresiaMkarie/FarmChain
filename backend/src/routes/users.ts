import { Router, Request, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /users/:publicKey  —  public profile lookup
router.get('/:publicKey', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, public_key, role, name, location, chain_verified, created_at FROM users WHERE public_key = $1',
      [req.params.publicKey],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ user: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /users/verify-chain  —  mark the authenticated user as chain-verified
router.patch('/verify-chain', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'UPDATE users SET chain_verified = TRUE WHERE public_key = $1',
      [req.user!.publicKey],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to verify chain status' });
  }
});

// GET /users/:publicKey/history  —  order history (caller must be the owner or admin)
router.get('/:publicKey/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.publicKey !== req.params.publicKey && req.user!.role !== 'Admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT o.* FROM orders o
       WHERE o.farmer_pk = $1 OR o.buyer_pk = $1
       ORDER BY o.created_at DESC LIMIT 50`,
      [req.params.publicKey],
    );
    res.json({ history: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
