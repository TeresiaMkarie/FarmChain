import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const UPLOADS_DIR = path.join(__dirname, '../../../uploads/avatars');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

// PATCH /users/me  — update own profile
router.patch('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const allowed = [
    'name', 'phone', 'location', 'email',
    'country', 'county', 'city', 'address_line',
    'latitude', 'longitude',
    'payout_wallet', 'preferred_currency', 'preferred_language',
  ];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      setClauses.push(`${field} = $${idx++}`);
      values.push(req.body[field] === '' ? null : req.body[field]);
    }
  }

  if (setClauses.length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(req.user!.publicKey);

  try {
    const result = await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE public_key = $${idx} RETURNING *`,
      values,
    );
    res.json({ user: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to update profile' });
  }
});

// POST /users/me/avatar  — upload profile photo to IPFS and save URL
router.post('/me/avatar', authMiddleware, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image provided. Accepted formats: JPEG, PNG, WebP (max 2 MB).' });
    return;
  }
  try {
    const ext = req.file.mimetype.split('/')[1].replace('jpeg', 'jpg');
    const filename = `${req.user!.publicKey.slice(0, 12)}-${Date.now()}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    // Delete previous avatar file for this user (best-effort)
    const prev = await pool.query('SELECT avatar_url FROM users WHERE public_key = $1', [req.user!.publicKey]);
    const prevUrl: string | null = prev.rows[0]?.avatar_url ?? null;
    if (prevUrl) {
      const prevFile = path.join(UPLOADS_DIR, path.basename(prevUrl));
      fs.unlink(prevFile, () => {});
    }

    fs.writeFileSync(filepath, req.file.buffer);

    const baseUrl = process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
    const avatarUrl = `${baseUrl}/uploads/avatars/${filename}`;

    const result = await pool.query(
      `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE public_key = $2 RETURNING *`,
      [avatarUrl, req.user!.publicKey],
    );
    res.json({ user: result.rows[0], avatarUrl });
  } catch (err: any) {
    console.error('[avatar upload] error:', err.message);
    res.status(500).json({ error: err.message ?? 'Failed to save avatar' });
  }
});

// GET /users/me/notifications  — fetch notification preferences
router.get('/me/notifications', authMiddleware, async (req: AuthRequest, res: Response) => {
  const pk = req.user!.publicKey;
  try {
    // Upsert default row if not present
    await pool.query(
      `INSERT INTO user_notifications (public_key) VALUES ($1) ON CONFLICT DO NOTHING`,
      [pk],
    );
    const result = await pool.query(
      'SELECT * FROM user_notifications WHERE public_key = $1',
      [pk],
    );
    res.json({ notifications: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to fetch notifications' });
  }
});

// PUT /users/me/notifications  — replace notification preferences
router.put('/me/notifications', authMiddleware, async (req: AuthRequest, res: Response) => {
  const pk = req.user!.publicKey;
  const fields = [
    'txn_inapp','txn_email','txn_sms',
    'wallet_inapp','wallet_email','wallet_sms',
    'marketplace_inapp','marketplace_email','marketplace_sms',
    'payment_inapp','payment_email','payment_sms',
    'dispute_inapp','dispute_email','dispute_sms',
    'promo_inapp','promo_email','promo_sms',
  ];

  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`);
  const values: unknown[] = [pk, ...fields.map((f) => Boolean(req.body[f]))];

  try {
    await pool.query(
      `INSERT INTO user_notifications (public_key, ${fields.join(', ')})
       VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (public_key) DO UPDATE SET ${setClauses.join(', ')}, updated_at = NOW()`,
      values,
    );
    const result = await pool.query(
      'SELECT * FROM user_notifications WHERE public_key = $1',
      [pk],
    );
    res.json({ notifications: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to update notifications' });
  }
});

// GET /users/me/sessions  — list active sessions
router.get('/me/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  const tokenHash = hashToken(req.headers.authorization!.slice(7));
  try {
    const result = await pool.query(
      `SELECT id, user_agent, ip_address, created_at, last_seen_at, token_hash
       FROM user_sessions
       WHERE public_key = $1 AND revoked = FALSE
       ORDER BY last_seen_at DESC`,
      [req.user!.publicKey],
    );
    const sessions = result.rows.map((s) => ({
      ...s,
      current: s.token_hash === tokenHash,
      token_hash: undefined,  // never expose hash to client
    }));
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to fetch sessions' });
  }
});

// DELETE /users/me/sessions/:id  — revoke a specific session
router.delete('/me/sessions/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `UPDATE user_sessions SET revoked = TRUE
       WHERE id = $1 AND public_key = $2 AND revoked = FALSE
       RETURNING id`,
      [req.params.id, req.user!.publicKey],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to revoke session' });
  }
});

// DELETE /users/me/sessions  — revoke all OTHER sessions
router.delete('/me/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  const tokenHash = hashToken(req.headers.authorization!.slice(7));
  try {
    await pool.query(
      `UPDATE user_sessions SET revoked = TRUE
       WHERE public_key = $1 AND token_hash != $2 AND revoked = FALSE`,
      [req.user!.publicKey, tokenHash],
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to revoke sessions' });
  }
});

// GET /users/:publicKey  — public profile lookup
router.get('/:publicKey', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, public_key, role, name, location, country, city, chain_verified, created_at
       FROM users WHERE public_key = $1`,
      [req.params.publicKey],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ user: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /users/verify-chain
router.patch('/verify-chain', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'UPDATE users SET chain_verified = TRUE WHERE public_key = $1',
      [req.user!.publicKey],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to verify chain status' });
  }
});

// GET /users/:publicKey/history
router.get('/:publicKey/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user!.publicKey !== req.params.publicKey && req.user!.role !== 'Admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT o.* FROM orders o
       WHERE o.farmer_pk = $1 OR o.buyer_pk = $1
       ORDER BY o.created_at DESC LIMIT 50`,
      [req.params.publicKey],
    );
    res.json({ history: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default router;
