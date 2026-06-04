import { Router, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /orders
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { publicKey, role } = req.user!;
  const col = role === 'Farmer' ? 'farmer_pk' : 'buyer_pk';
  const result = await pool.query(
    `SELECT o.*, p.name AS product_name FROM orders o
     LEFT JOIN products p ON o.product_id = p.id
     WHERE o.${col} = $1 ORDER BY o.created_at DESC`,
    [publicKey]
  );
  res.json({ orders: result.rows });
});

// GET /orders/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ order: result.rows[0] });
});

// POST /orders
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { productId, quantity, deliveryAddress } = req.body;
  const product = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
  if (!product.rows[0]) { res.status(404).json({ error: 'Product not found' }); return; }

  const p = product.rows[0];
  const amount = p.price_xlm * quantity;

  const result = await pool.query(
    `INSERT INTO orders (product_id, farmer_pk, buyer_pk, amount, status)
     VALUES ($1, $2, $3, $4, 'created') RETURNING *`,
    [productId, p.farmer_pk, req.user!.publicKey, amount]
  );
  res.json({ order: result.rows[0], orderId: result.rows[0].id });
});

// PATCH /orders/:id/fund
router.patch('/:id/fund', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { escrowId, txHash, onChainOrderId } = req.body;
  await pool.query(
    `UPDATE orders SET status='funded', escrow_id=$1, tx_hash=$2, on_chain_order_id=$3, updated_at=NOW()
     WHERE id=$4`,
    [escrowId, txHash, onChainOrderId, req.params.id]
  );
  res.json({ ok: true });
});

// POST /orders/:id/ship
router.post('/:id/ship', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { trackingInfo } = req.body;
  await pool.query(
    `UPDATE orders SET status='shipped', tracking_info=$1, updated_at=NOW() WHERE id=$2`,
    [trackingInfo, req.params.id]
  );
  res.json({ ok: true });
});

// POST /orders/:id/complete
router.post('/:id/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { txHash } = req.body;
  await pool.query(
    `UPDATE orders SET status='completed', tx_hash=$1, updated_at=NOW() WHERE id=$2`,
    [txHash ?? null, req.params.id]
  );
  // Insert receipt record
  await pool.query(
    `INSERT INTO receipts (order_id, tx_hash) VALUES ($1, $2)`,
    [req.params.id, txHash ?? null]
  );
  res.json({ ok: true });
});

// POST /orders/:id/dispute
router.post('/:id/dispute', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { reason } = req.body;
  await pool.query(
    `UPDATE orders SET status='disputed', updated_at=NOW() WHERE id=$1`,
    [req.params.id]
  );
  await pool.query(
    `INSERT INTO disputes (order_id, raised_by, reason) VALUES ($1, $2, $3)`,
    [req.params.id, req.user!.publicKey, reason ?? null]
  );
  res.json({ ok: true });
});

// PATCH /orders/:id/resolve  (admin only)
router.patch('/:id/resolve', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'Admin') { res.status(403).json({ error: 'Admin only' }); return; }
  const { resolution, farmerBps } = req.body;
  const status = farmerBps === 0 ? 'refunded' : 'completed';
  await pool.query(
    `UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2`,
    [status, req.params.id]
  );
  await pool.query(
    `UPDATE disputes SET status='resolved', resolution=$1 WHERE order_id=$2`,
    [resolution, req.params.id]
  );
  res.json({ ok: true });
});

export default router;
