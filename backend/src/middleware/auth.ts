import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/client';

export interface AuthRequest extends Request {
  user?: { publicKey: string; role: string; userId: string };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token' });
    return;
  }
  let payload: { publicKey: string; role: string; userId: string };
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as typeof payload;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  // A2: Reject requests from suspended users
  try {
    const result = await pool.query(
      'SELECT suspended_at, suspension_reason FROM users WHERE public_key = $1',
      [payload.publicKey],
    );
    const user = result.rows[0];
    if (user?.suspended_at) {
      res.status(403).json({ error: `Account suspended: ${user.suspension_reason ?? 'contact support'}` });
      return;
    }
  } catch {
    // Non-fatal: if DB check fails, let the request through rather than locking everyone out
  }
  req.user = { publicKey: payload.publicKey, role: payload.role, userId: payload.userId };
  next();
}
