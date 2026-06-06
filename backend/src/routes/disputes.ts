import { Router, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /disputes  — returns disputes relevant to the caller
// Farmer: disputes on their products' orders
// Buyer:  disputes they raised
// Admin:  all disputes
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { publicKey, role } = req.user!;
  try {
    const base = `
      SELECT d.*, o.product_id, o.buyer_pk, o.farmer_pk, o.amount, p.name AS product_name
      FROM disputes d
      JOIN orders o ON d.order_id = o.id
      LEFT JOIN products p ON o.product_id = p.id
    `;
    let result;
    if (role === 'Admin') {
      result = await pool.query(`${base} ORDER BY d.created_at DESC`);
    } else if (role === 'Farmer') {
      result = await pool.query(
        `${base} WHERE o.farmer_pk = $1 ORDER BY d.created_at DESC`,
        [publicKey],
      );
    } else {
      result = await pool.query(
        `${base} WHERE d.raised_by = $1 ORDER BY d.created_at DESC`,
        [publicKey],
      );
    }
    res.json({ disputes: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to fetch disputes' });
  }
});

export default router;
