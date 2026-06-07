import { Router, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { notify } from './notifications';

const router = Router();

// GET /orders  — paginated, optional ?status=funded,shipped filter
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { publicKey, role } = req.user!;
  const col = role === 'Farmer' ? 'farmer_pk' : 'buyer_pk';

  const limit = Math.min(parseInt(req.query.limit as string ?? '50', 10), 100);
  const offset = parseInt(req.query.offset as string ?? '0', 10);
  const ALLOWED_STATUSES = new Set(['created','funded','shipped','completed','disputed','refunded','resolved','cancelled']);
  const rawStatuses = typeof req.query.status === 'string' ? req.query.status.split(',') : [];
  const statusFilter = rawStatuses.filter((s) => ALLOWED_STATUSES.has(s));

  try {
    const values: unknown[] = [publicKey];
    let statusClause = '';
    if (statusFilter.length > 0) {
      const placeholders = statusFilter.map((_, i) => `$${i + 2}`).join(',');
      statusClause = `AND o.status IN (${placeholders})`;
      values.push(...statusFilter);
    }
    values.push(limit, offset);
    const limitIdx = values.length - 1;
    const offsetIdx = values.length;

    const result = await pool.query(
      `SELECT o.*, p.name AS product_name, p.image_cids
       FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       WHERE o.${col} = $1 ${statusClause}
       ORDER BY o.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values,
    );

    const countValues: unknown[] = [publicKey];
    let countStatusClause = '';
    if (statusFilter.length > 0) {
      const placeholders = statusFilter.map((_, i) => `$${i + 2}`).join(',');
      countStatusClause = `AND status IN (${placeholders})`;
      countValues.push(...statusFilter);
    }
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM orders WHERE ${col} = $1 ${countStatusClause}`,
      countValues,
    );

    res.json({ orders: result.rows, total: parseInt(countResult.rows[0].total, 10) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /orders/:id  — includes product info + dispute record
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT o.*,
         p.name AS product_name, p.image_cids, p.unit, p.category, p.status AS product_status,
         d.id AS dispute_id, d.raised_by AS dispute_raised_by, d.reason AS dispute_reason,
         d.status AS dispute_status, d.resolution AS dispute_resolution,
         d.created_at AS dispute_created_at
       FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       LEFT JOIN disputes d ON d.order_id = o.id
       WHERE o.id = $1`,
      [req.params.id],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const order = result.rows[0];
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
  const { productId, quantity, deliveryAddress, deliveryDate } = req.body;
  if (!productId || !quantity || quantity < 1) {
    res.status(400).json({ error: 'productId and quantity required' });
    return;
  }
  if (!deliveryAddress || !String(deliveryAddress).trim()) {
    res.status(400).json({ error: 'deliveryAddress is required' });
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
      res.status(409).json({ error: 'Insufficient product quantity', available: p.quantity });
      return;
    }
    const amount = BigInt(p.price_xlm) * BigInt(quantity);
    const result = await pool.query(
      `INSERT INTO orders (product_id, farmer_pk, buyer_pk, amount, quantity, delivery_address, delivery_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'created') RETURNING *`,
      [productId, p.farmer_pk, req.user!.publicKey, amount.toString(), quantity, deliveryAddress, deliveryDate ?? null],
    );
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
    await notify(orderRes.rows[0].farmer_pk, 'order_funded', { orderId: req.params.id });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to fund order' });
  }
});

// Shared helper: restore stock and remove or cancel an unfunded order.
// hardDelete=true  → used for programmatic rollback (escrow tx failed before funding)
//                    removes the row entirely so it never appears in the buyer's history
// hardDelete=false → used for buyer-initiated cancel; sets status='cancelled'
async function cancelOrAbortOrder(
  orderId: string,
  buyerPk: string,
  hardDelete: boolean,
  res: Response,
) {
  const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!orderRes.rows[0]) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const order = orderRes.rows[0];
  if (order.buyer_pk !== buyerPk) {
    res.status(403).json({ error: 'Only the buyer can cancel this order' });
    return;
  }
  if (order.status !== 'created') {
    res.status(409).json({ error: 'Only unfunded orders can be cancelled' });
    return;
  }
  if (hardDelete) {
    await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
  } else {
    await pool.query(
      `UPDATE orders SET status='cancelled', updated_at=NOW() WHERE id=$1`,
      [orderId],
    );
  }
  // Restore product quantity in both cases
  await pool.query(
    `UPDATE products
       SET quantity = quantity + $1,
           status   = CASE WHEN status = 'sold' THEN 'active' ELSE status END
     WHERE id = $2`,
    [order.quantity ?? 1, order.product_id],
  );
  res.json({ ok: true });
}

// DELETE /orders/:id — buyer-initiated cancel; sets status='cancelled' (visible in history)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await cancelOrAbortOrder(String(req.params.id), req.user!.publicKey, false, res);
  } catch {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// DELETE /orders/:id/abort — programmatic rollback after escrow tx failure; hard-deletes the row
// so a payment error never leaves a phantom 'cancelled' entry in the buyer's history
router.delete('/:id/abort', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await cancelOrAbortOrder(String(req.params.id), req.user!.publicKey, true, res);
  } catch {
    res.status(500).json({ error: 'Failed to abort order' });
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
    const { trackingInfo, txHash } = req.body;
    const result = await pool.query(
      `UPDATE orders SET status='shipped', tracking_info=$1, tx_hash=$2, updated_at=NOW()
       WHERE id=$3 AND status='funded'
       RETURNING id`,
      [trackingInfo ?? null, txHash ?? null, req.params.id],
    );
    if (result.rowCount === 0) {
      res.status(409).json({ error: 'Order is not in funded state' });
      return;
    }
    await notify(orderRes.rows[0].buyer_pk, 'order_shipped', { orderId: req.params.id, trackingInfo: trackingInfo ?? null });
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
    await notify(orderRes.rows[0].farmer_pk, 'order_completed', { orderId: req.params.id });
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
    // Notify both parties
    const otherPk = req.user!.publicKey === order.buyer_pk ? order.farmer_pk : order.buyer_pk;
    await notify(otherPk, 'dispute_raised', { orderId: req.params.id });
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

// GET /orders/export?format=csv  — F3: download orders as CSV
router.get('/export', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { publicKey, role } = req.user!;
  const col = role === 'Farmer' ? 'farmer_pk' : 'buyer_pk';
  try {
    const result = await pool.query(
      `SELECT o.id, o.status, o.amount, o.quantity, o.delivery_address, o.delivery_date,
              o.created_at, o.updated_at, o.tracking_info, o.tx_hash,
              o.farmer_pk, o.buyer_pk, p.name AS product_name
       FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       WHERE o.${col} = $1
       ORDER BY o.created_at DESC`,
      [publicKey],
    );
    const headers = ['id','status','amount_stroops','quantity','product','delivery_address','delivery_date','tracking_info','tx_hash','farmer_pk','buyer_pk','created_at','updated_at'];
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = result.rows.map((r) =>
      [r.id,r.status,r.amount,r.quantity,r.product_name,r.delivery_address,r.delivery_date,r.tracking_info,r.tx_hash,r.farmer_pk,r.buyer_pk,r.created_at,r.updated_at].map(escape).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="farmchain-orders-${Date.now()}.csv"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Failed to export orders' });
  }
});

export default router;
