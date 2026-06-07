import { Router, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { notify } from './notifications';

const router = Router();

// GET /messages?orderId=X  — returns thread for this order (party-gated)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { orderId } = req.query;
  if (!orderId || typeof orderId !== 'string') {
    res.status(400).json({ error: 'orderId is required' });
    return;
  }
  try {
    // Verify caller is a party to the order
    const orderRes = await pool.query(
      `SELECT buyer_pk, farmer_pk FROM orders WHERE id = $1`,
      [orderId],
    );
    const order = orderRes.rows[0];
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    if (order.buyer_pk !== req.user!.publicKey && order.farmer_pk !== req.user!.publicKey && req.user!.role !== 'Admin') {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    const result = await pool.query(
      `SELECT m.*, u.name AS sender_name
       FROM messages m
       JOIN users u ON m.sender_pk = u.public_key
       WHERE m.order_id = $1
       ORDER BY m.created_at ASC`,
      [orderId],
    );
    res.json({ messages: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /messages  — send a message in an order thread
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { orderId, body } = req.body;
  if (!orderId || !body?.trim()) {
    res.status(400).json({ error: 'orderId and body are required' });
    return;
  }
  if (body.trim().length > 2000) {
    res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    return;
  }
  try {
    const orderRes = await pool.query(
      `SELECT buyer_pk, farmer_pk FROM orders WHERE id = $1`,
      [orderId],
    );
    const order = orderRes.rows[0];
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    if (order.buyer_pk !== req.user!.publicKey && order.farmer_pk !== req.user!.publicKey) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    const result = await pool.query(
      `INSERT INTO messages (order_id, sender_pk, body) VALUES ($1, $2, $3) RETURNING *`,
      [orderId, req.user!.publicKey, body.trim()],
    );

    // Notify the other party
    const otherPk = req.user!.publicKey === order.buyer_pk ? order.farmer_pk : order.buyer_pk;
    await notify(otherPk, 'new_message', { orderId, senderPk: req.user!.publicKey });

    res.json({ message: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
