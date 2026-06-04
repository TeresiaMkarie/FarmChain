import { Router, Response } from 'express';
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

// GET /products
router.get('/', async (_req, res: Response) => {
  const result = await pool.query(
    `SELECT p.*, u.name AS farmer_name, u.location
     FROM products p
     JOIN users u ON p.farmer_pk = u.public_key
     WHERE p.status = 'active'
     ORDER BY p.created_at DESC`
  );
  res.json({ products: result.rows });
});

// GET /products/:id
router.get('/:id', async (req, res: Response) => {
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ product: result.rows[0] });
});

// POST /products
router.post('/', authMiddleware, upload.array('images', 5), async (req: AuthRequest, res: Response) => {
  const { name, category, quantity, unit, priceXlm, description } = req.body;
  const files = req.files as Express.Multer.File[];

  try {
    const cids: string[] = [];
    for (const file of files ?? []) {
      const cid = await pinToIPFS(file.buffer, file.originalname);
      cids.push(cid);
    }

    const metaObj = { name, category, quantity, unit, priceXlm, farmerPk: req.user!.publicKey };
    const crypto = await import('crypto');
    const metadataHash = crypto.createHash('sha256').update(JSON.stringify(metaObj)).digest('hex');

    const result = await pool.query(
      `INSERT INTO products (farmer_pk, name, category, quantity, unit, price_xlm, image_cids, metadata_hash, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user!.publicKey, name, category, quantity, unit, priceXlm, cids, metadataHash, description ?? null]
    );
    res.json({ product: result.rows[0], productId: result.rows[0].id, metadataHash });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /products/:id/activate
router.patch('/:id/activate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { onChainId, txHash } = req.body;
  await pool.query(
    `UPDATE products SET status = 'active', on_chain_id = $1 WHERE id = $2 AND farmer_pk = $3`,
    [onChainId, req.params.id, req.user!.publicKey]
  );
  res.json({ ok: true });
});

// DELETE /products/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  await pool.query(
    `UPDATE products SET status = 'cancelled' WHERE id = $1 AND farmer_pk = $2`,
    [req.params.id, req.user!.publicKey]
  );
  res.json({ ok: true });
});

export default router;
