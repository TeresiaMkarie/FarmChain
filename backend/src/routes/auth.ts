import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { publicKey, role, name, phone, location } = req.body;
  if (!publicKey || !role || !name) {
    res.status(400).json({ error: 'publicKey, role, and name required' });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO users (public_key, role, name, phone, location)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (public_key) DO NOTHING
       RETURNING *`,
      [publicKey, role, name, phone ?? null, location ?? null]
    );
    const user = result.rows[0];
    if (!user) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }
    const token = jwt.sign(
      { publicKey: user.public_key, role: user.role, userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, publicKey: user.public_key, role: user.role, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { publicKey } = req.body;
  if (!publicKey) { res.status(400).json({ error: 'publicKey required' }); return; }
  try {
    const result = await pool.query('SELECT * FROM users WHERE public_key = $1', [publicKey]);
    const user = result.rows[0];
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const token = jwt.sign(
      { publicKey: user.public_key, role: user.role, userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, publicKey: user.public_key, role: user.role, name: user.name } });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE public_key = $1', [req.user!.publicKey]);
    res.json({ user: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
