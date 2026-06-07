import { Router, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const FREQ_DAYS: Record<string, number> = { weekly: 7, fortnightly: 14, monthly: 30 };

function nextDue(frequency: string): Date {
  const days = FREQ_DAYS[frequency] ?? 7;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// GET /recurring  — buyer's active recurring orders
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT r.*, p.name AS product_name, p.unit, p.price_xlm, p.image_cids
       FROM recurring_orders r
       JOIN products p ON r.product_id = p.id
       WHERE r.buyer_pk = $1
       ORDER BY r.created_at DESC`,
      [req.user!.publicKey],
    );
    res.json({ recurring: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch recurring orders' });
  }
});

// POST /recurring  — set up a recurring order
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'Buyer') {
    res.status(403).json({ error: 'Only buyers can set up recurring orders' });
    return;
  }
  const { productId, quantity, deliveryAddress, frequency } = req.body;
  if (!productId || !quantity || !deliveryAddress || !frequency) {
    res.status(400).json({ error: 'productId, quantity, deliveryAddress, and frequency are required' });
    return;
  }
  if (!FREQ_DAYS[frequency]) {
    res.status(400).json({ error: 'frequency must be weekly, fortnightly, or monthly' });
    return;
  }
  const parsedQty = parseInt(quantity, 10);
  if (!Number.isFinite(parsedQty) || parsedQty < 1) {
    res.status(400).json({ error: 'quantity must be a positive integer' });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO recurring_orders (buyer_pk, product_id, quantity, delivery_address, frequency, next_due_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user!.publicKey, productId, parsedQty, deliveryAddress, frequency, nextDue(frequency)],
    );
    res.json({ recurring: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to create recurring order' });
  }
});

// PATCH /recurring/:id  — pause or resume
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE recurring_orders SET active = $1 WHERE id = $2 AND buyer_pk = $3 RETURNING id`,
      [active !== false, req.params.id, req.user!.publicKey],
    );
    if (result.rowCount === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to update recurring order' });
  }
});

// DELETE /recurring/:id  — cancel
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      `DELETE FROM recurring_orders WHERE id = $1 AND buyer_pk = $2`,
      [req.params.id, req.user!.publicKey],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to cancel recurring order' });
  }
});

export default router;
