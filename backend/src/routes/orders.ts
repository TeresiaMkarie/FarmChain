import { Router, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /orders
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { publicKey, role } = req.user!;
  const col = role === 'Farmer' ? 'farmer_pk' : 'buyer_pk';
  try {
    const result = await pool.query(
      `SELECT o.*, p.name AS product_name FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       WHERE o.${col} = $1 ORDER BY o.created_at DESC`,
      [publicKey],
    );
    res.json({ orders: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /orders/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const order = result.rows[0];
    // Only the parties to the order may view it
    if (order.buyer_pk !== req.user!.publicKey && order.farmer_pk !== req.user!.publicKey && req.user!.role !== 'Admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    res.json({ order });
  } catch {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// POST /orders
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { productId, quantity, deliveryAddress } = req.body;
  if (!productId || !quantity || quantity < 1) {
    res.status(400).json({ error: 'productId and quantity required' });
    return;
  }
  try {
    const productRes = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (!productRes.rows[0]) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const p = productRes.rows[0];
    if (p.status !== 'active') {
      res.status(409).json({ error: 'Product is not available' });
      return;
    }
    if (p.quantity < quantity) {
      res.status(409).json({ error: 'Insufficient product quantity' });
      return;
    }
    const amount = BigInt(p.price_xlm) * BigInt(quantity);
    const result = await pool.query(
      `INSERT INTO orders (product_id, farmer_pk, buyer_pk, amount, delivery_address, status)
       VALUES ($1, $2, $3, $4, $5, 'created') RETURNING *`,
      [productId, p.farmer_pk, req.user!.publicKey, amount.toString(), deliveryAddress ?? null],
    );
    // Decrement product quantity; auto-mark sold when exhausted
    await pool.query(
      `UPDATE products
         SET quantity = GREATEST(quantity - $1, 0),
             status   = CASE WHEN quantity - $1 <= 0 THEN 'sold' ELSE status END
       WHERE id = $2`,
      [quantity, productId],
    );
    res.json({ order: result.rows[0], orderId: result.rows[0].id });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to create order' });
  }
});

// PATCH /orders/:id/fund  — buyer only
router.patch('/:id/fund', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!orderRes.rows[0]) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (orderRes.rows[0].buyer_pk !== req.user!.publicKey) {
      res.status(403).json({ error: 'Only the buyer can fund this order' });
      return;
    }
    const { escrowId, txHash, onChainOrderId } = req.body;
    const result = await pool.query(
      `UPDATE orders SET status='funded', escrow_id=$1, tx_hash=$2, on_chain_order_id=$3, updated_at=NOW()
       WHERE id=$4 AND status='created'
       RETURNING id`,
      [escrowId ?? null, txHash ?? null, onChainOrderId ?? null, req.params.id],
    );
    if (result.rowCount === 0) {
      res.status(409).json({ error: 'Order already funded or not in created state' });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to fund order' });
  }
});

// POST /orders/:id/ship  — farmer only
router.post('/:id/ship', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!orderRes.rows[0]) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (orderRes.rows[0].farmer_pk !== req.user!.publicKey) {
      res.status(403).json({ error: 'Only the farmer can mark this order as shipped' });
      return;
    }
    const { trackingInfo } = req.body;
    const result = await pool.query(
      `UPDATE orders SET status='shipped', tracking_info=$1, updated_at=NOW()
       WHERE id=$2 AND status='funded'
       RETURNING id`,
      [trackingInfo ?? null, req.params.id],
    );
    if (result.rowCount === 0) {
      res.status(409).json({ error: 'Order is not in funded state' });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to ship order' });
  }
});

// POST /orders/:id/complete  — buyer only
router.post('/:id/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!orderRes.rows[0]) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (orderRes.rows[0].buyer_pk !== req.user!.publicKey) {
      res.status(403).json({ error: 'Only the buyer can confirm delivery' });
      return;
    }
    const { txHash } = req.body;
    const result = await pool.query(
      `UPDATE orders SET status='completed', tx_hash=$1, updated_at=NOW()
       WHERE id=$2 AND status='shipped'
       RETURNING id`,
      [txHash ?? null, req.params.id],
    );
    if (result.rowCount === 0) {
      res.status(409).json({ error: 'Order is not in shipped state' });
      return;
    }
    await pool.query(
      `INSERT INTO receipts (order_id, tx_hash) VALUES ($1, $2)`,
      [req.params.id, txHash ?? null],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to complete order' });
  }
});

// POST /orders/:id/dispute  — buyer or farmer only
router.post('/:id/dispute', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!orderRes.rows[0]) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const order = orderRes.rows[0];
    if (order.buyer_pk !== req.user!.publicKey && order.farmer_pk !== req.user!.publicKey) {
      res.status(403).json({ error: 'Only parties to this order can raise a dispute' });
      return;
    }
    const { reason } = req.body;
    const result = await pool.query(
      `UPDATE orders SET status='disputed', updated_at=NOW()
       WHERE id=$1 AND status IN ('funded','shipped')
       RETURNING id`,
      [req.params.id],
    );
    if (result.rowCount === 0) {
      res.status(409).json({ error: 'Order cannot be disputed in its current state' });
      return;
    }
    await pool.query(
      `INSERT INTO disputes (order_id, raised_by, reason) VALUES ($1, $2, $3)`,
      [req.params.id, req.user!.publicKey, reason ?? null],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to raise dispute' });
  }
});

// PATCH /orders/:id/resolve  — admin only
router.patch('/:id/resolve', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'Admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  try {
    const { resolution, farmerBps } = req.body;
    if (typeof farmerBps !== 'number' || farmerBps < 0 || farmerBps > 10_000) {
      res.status(400).json({ error: 'farmerBps must be 0-10000' });
      return;
    }
    // Only set 'completed' for a 100% farmer payout; partial = 'resolved'
    const status = farmerBps === 0 ? 'refunded' : farmerBps === 10_000 ? 'completed' : 'resolved';
    const result = await pool.query(
      `UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 AND status='disputed' RETURNING id`,
      [status, req.params.id],
    );
    if (result.rowCount === 0) {
      res.status(409).json({ error: 'Order is not in disputed state' });
      return;
    }
    await pool.query(
      `UPDATE disputes SET status='resolved', resolution=$1 WHERE order_id=$2`,
      [resolution ?? null, req.params.id],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

export default router;
