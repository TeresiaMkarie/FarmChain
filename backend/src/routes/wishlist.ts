import { Router, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /wishlist  — buyer's saved products
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT w.product_id, w.created_at, p.name, p.category, p.quantity, p.unit,
              p.price_xlm, p.image_cids, p.status, p.farmer_pk, u.name AS farmer_name
       FROM wishlists w
       JOIN products p ON w.product_id = p.id
       JOIN users u ON p.farmer_pk = u.public_key
       WHERE w.buyer_pk = $1
       ORDER BY w.created_at DESC`,
      [req.user!.publicKey],
    );
    res.json({ wishlist: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// POST /wishlist/:productId  — add to wishlist
router.post('/:productId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      `INSERT INTO wishlists (buyer_pk, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user!.publicKey, req.params.productId],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// DELETE /wishlist/:productId  — remove from wishlist
router.delete('/:productId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      `DELETE FROM wishlists WHERE buyer_pk = $1 AND product_id = $2`,
      [req.user!.publicKey, req.params.productId],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

// GET /wishlist/check/:productId  — is this product wishlisted?
router.get('/check/:productId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT 1 FROM wishlists WHERE buyer_pk = $1 AND product_id = $2`,
      [req.user!.publicKey, req.params.productId],
    );
    res.json({ wishlisted: result.rowCount! > 0 });
  } catch {
    res.status(500).json({ error: 'Failed to check wishlist' });
  }
});

export default router;
