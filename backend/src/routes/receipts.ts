import { Router, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /receipts/:orderId  — party-gated receipt for a completed order
router.get('/:orderId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.order_id, r.tx_hash, r.created_at,
         o.buyer_pk, o.farmer_pk, o.amount, o.quantity,
         p.name AS product_name, p.unit, p.category
       FROM receipts r
       JOIN orders o ON r.order_id = o.id
       LEFT JOIN products p ON o.product_id = p.id
       WHERE r.order_id = $1`,
      [req.params.orderId],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }
    const receipt = result.rows[0];
    if (receipt.buyer_pk !== req.user!.publicKey && receipt.farmer_pk !== req.user!.publicKey && req.user!.role !== 'Admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    res.json({ receipt });
  } catch {
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

export default router;
