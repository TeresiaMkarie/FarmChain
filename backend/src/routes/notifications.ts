import { Router, Response } from 'express';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /notifications  — returns caller's notifications (newest first, limit 50)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_pk = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user!.publicKey],
    );
    res.json({ notifications: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /notifications/unread-count
router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_pk = $1 AND read = FALSE`,
      [req.user!.publicKey],
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// PATCH /notifications/read-all  — mark all as read
router.patch('/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      `UPDATE notifications SET read = TRUE WHERE user_pk = $1 AND read = FALSE`,
      [req.user!.publicKey],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

export default router;

// Helper called from order routes to insert a notification
export async function notify(userPk: string, type: string, payload: object) {
  await pool.query(
    `INSERT INTO notifications (user_pk, type, payload) VALUES ($1, $2, $3)`,
    [userPk, type, JSON.stringify(payload)],
  ).catch(() => { /* non-fatal */ });
}
