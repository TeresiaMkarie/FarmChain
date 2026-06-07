import { Router, Request, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /reviews?productId=X  — public, returns reviews + average rating
router.get('/', async (req: Request, res: Response) => {
  const { productId } = req.query;
  if (!productId || typeof productId !== 'string') {
    res.status(400).json({ error: 'productId is required' });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT r.*, u.name AS buyer_name
       FROM reviews r
       JOIN users u ON r.buyer_pk = u.public_key
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC`,
      [productId],
    );
    const rows = result.rows;
    const avg = rows.length
      ? (rows.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / rows.length)
      : null;
    res.json({ reviews: rows, averageRating: avg ? parseFloat(avg.toFixed(1)) : null, count: rows.length });
  } catch {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST /reviews  — buyer only, once per completed order
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'Buyer') {
    res.status(403).json({ error: 'Only buyers can submit reviews' });
    return;
  }
  const { orderId, rating, comment } = req.body;
  if (!orderId || !rating) {
    res.status(400).json({ error: 'orderId and rating are required' });
    return;
  }
  const parsedRating = parseInt(rating, 10);
  if (parsedRating < 1 || parsedRating > 5) {
    res.status(400).json({ error: 'rating must be between 1 and 5' });
    return;
  }
  try {
    // Verify the order belongs to this buyer and is completed
    const orderRes = await pool.query(
      `SELECT product_id, buyer_pk, status FROM orders WHERE id = $1`,
      [orderId],
    );
    const order = orderRes.rows[0];
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (order.buyer_pk !== req.user!.publicKey) {
      res.status(403).json({ error: 'You did not place this order' });
      return;
    }
    if (order.status !== 'completed') {
      res.status(409).json({ error: 'You can only review completed orders' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO reviews (order_id, product_id, buyer_pk, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (order_id) DO NOTHING
       RETURNING *`,
      [orderId, order.product_id, req.user!.publicKey, parsedRating, comment?.trim() || null],
    );
    if (result.rowCount === 0) {
      res.status(409).json({ error: 'You have already reviewed this order' });
      return;
    }
    res.json({ review: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

export default router;
