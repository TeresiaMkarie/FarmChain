import { Router, Request, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

async function pinToIPFS(buffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append('file', buffer, { filename });
  const res = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', form, {
    headers: {
      ...form.getHeaders(),
      pinata_api_key: process.env.PINATA_API_KEY!,
      pinata_secret_api_key: process.env.PINATA_SECRET_KEY!,
    },
  });
  return res.data.IpfsHash as string;
}

// GET /products  —  public; ?farmer=<pk> returns all products for that farmer
router.get('/', async (req: Request, res: Response) => {
  try {
    const farmerPk = typeof req.query.farmer === 'string' ? req.query.farmer : null;
    let rows;
    if (farmerPk) {
      const result = await pool.query(
        `SELECT p.*, u.name AS farmer_name, u.location
         FROM products p
         JOIN users u ON p.farmer_pk = u.public_key
         WHERE p.farmer_pk = $1
         ORDER BY p.created_at DESC`,
        [farmerPk],
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        `SELECT p.*, u.name AS farmer_name, u.location
         FROM products p
         JOIN users u ON p.farmer_pk = u.public_key
         WHERE p.status = 'active'
         ORDER BY p.created_at DESC`,
      );
      rows = result.rows;
    }
    res.json({ products: rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /products/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name AS farmer_name, u.location
       FROM products p
       JOIN users u ON p.farmer_pk = u.public_key
       WHERE p.id = $1`,
      [req.params.id],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ product: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /products
router.post('/', authMiddleware, upload.array('images', 5), async (req: AuthRequest, res: Response) => {
  const { name, category, quantity, unit, priceXlm, description } = req.body;
  if (!name || !category || !quantity || !unit || !priceXlm) {
    res.status(400).json({ error: 'name, category, quantity, unit, and priceXlm are required' });
    return;
  }
  if (req.user!.role !== 'Farmer') {
    res.status(403).json({ error: 'Only farmers can list products' });
    return;
  }
  const files = req.files as Express.Multer.File[];
  try {
    const cids: string[] = [];
    for (const file of files ?? []) {
      const cid = await pinToIPFS(file.buffer, file.originalname);
      cids.push(cid);
    }
    const crypto = await import('crypto');
    const metaObj = { name, category, quantity, unit, priceXlm, farmerPk: req.user!.publicKey };
    const metadataHash = crypto.createHash('sha256').update(JSON.stringify(metaObj)).digest('hex');

    const result = await pool.query(
      `INSERT INTO products (farmer_pk, name, category, quantity, unit, price_xlm, image_cids, metadata_hash, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user!.publicKey, name, category, quantity, unit, priceXlm, cids, metadataHash, description ?? null],
    );
    res.json({ product: result.rows[0], productId: result.rows[0].id, metadataHash });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to create product' });
  }
});

// PATCH /products/:id/activate  — links DB record to on-chain ID after Soroban listing
router.patch('/:id/activate', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'Farmer') {
    res.status(403).json({ error: 'Only farmers can activate products' });
    return;
  }
  try {
    const { onChainId, txHash } = req.body;
    const result = await pool.query(
      `UPDATE products SET status = 'active', on_chain_id = $1, tx_hash = $2
       WHERE id = $3 AND farmer_pk = $4 AND status = 'pending'
       RETURNING id`,
      [onChainId ?? null, txHash ?? null, req.params.id, req.user!.publicKey],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Product not found, already active, or does not belong to you' });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to activate product' });
  }
});

// DELETE /products/:id  — delist (soft-delete)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'Farmer') {
    res.status(403).json({ error: 'Only farmers can delist products' });
    return;
  }
  try {
    const result = await pool.query(
      `UPDATE products SET status = 'cancelled' WHERE id = $1 AND farmer_pk = $2 RETURNING id`,
      [req.params.id, req.user!.publicKey],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Product not found or does not belong to you' });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delist product' });
  }
});

export default router;
