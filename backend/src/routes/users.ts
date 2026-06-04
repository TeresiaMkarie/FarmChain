import { Router, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/:publicKey', async (req, res: Response) => {
  const result = await pool.query('SELECT * FROM users WHERE public_key = $1', [req.params.publicKey]);
  if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ user: result.rows[0] });
});

router.patch('/verify-chain', authMiddleware, async (req: AuthRequest, res: Response) => {
  await pool.query(
    'UPDATE users SET chain_verified = TRUE WHERE public_key = $1',
    [req.user!.publicKey]
  );
  res.json({ ok: true });
});

router.get('/:publicKey/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    `SELECT o.* FROM orders o
     WHERE o.farmer_pk = $1 OR o.buyer_pk = $1
     ORDER BY o.created_at DESC LIMIT 50`,
    [req.params.publicKey]
  );
  res.json({ history: result.rows });
});

export default router;
