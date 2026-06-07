import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function recordSession(pool: any, publicKey: string, token: string, req: Request) {
  const tokenHash = hashToken(token);
  const userAgent = req.headers['user-agent'] ?? null;
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
    ?? req.socket.remoteAddress
    ?? null;
  await pool.query(
    `INSERT INTO user_sessions (public_key, token_hash, user_agent, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [publicKey, tokenHash, userAgent, ip],
  ).catch(() => { /* non-fatal if sessions table not yet migrated */ });
}
import {
  Keypair,
  TransactionBuilder,
  Account,
  Operation,
  BASE_FEE,
  Networks,
  Transaction,
} from '@stellar/stellar-sdk';
import pool from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;
// Must match the networkPassphrase used by the frontend (VITE_STELLAR_NETWORK=testnet)
const NETWORK = Networks.TESTNET;

// ---------------------------------------------------------------------------
// Challenge-response auth using signTransaction (battle-tested SEP-10 style).
// The challenge is a Stellar transaction XDR with a MANAGE_DATA op that
// embeds the nonce.  The user signs it with Freighter, proving key ownership.
// The nonce is also embedded in a short-lived JWT so the backend can verify
// the challenge was issued by us and hasn't expired.
// ---------------------------------------------------------------------------

// GET /auth/challenge?publicKey=G...
// Returns { challenge: txXDR, token: jwt({nonce, publicKey}) }
router.get('/challenge', (req: Request, res: Response) => {
  const { publicKey } = req.query;
  if (!publicKey || typeof publicKey !== 'string') {
    res.status(400).json({ error: 'publicKey required' });
    return;
  }

  const nonce = crypto.randomBytes(32).toString('hex');

  // Build a minimal challenge transaction (not submitted to the network).
  // Sequence number 0 → tx uses seq 1; the account need not exist on-chain.
  const account = new Account(publicKey, '0');
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.manageData({
      name: 'FarmChain Auth',
      value: Buffer.from(nonce, 'utf8'),
    }))
    .setTimeout(300)
    .build();

  const token = jwt.sign({ nonce, publicKey }, JWT_SECRET, { expiresIn: '5m' });
  res.json({ challenge: tx.toXDR(), token });
});

// Verify that the signed transaction XDR proves ownership of publicKey and
// that the embedded nonce matches the one from our challenge JWT.
function verifySignature(publicKey: string, token: string, signedXDR: string): boolean {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { nonce: string; publicKey: string };
    if (payload.publicKey !== publicKey) return false;

    const tx = new Transaction(signedXDR, NETWORK);

    // Confirm the MANAGE_DATA op contains our nonce
    const op = tx.operations[0] as unknown as { type: string; name: string; value: Buffer | undefined };
    if (op?.type !== 'manageData') return false;
    if (op.name !== 'FarmChain Auth') return false;
    if (!op.value || op.value.toString('utf8') !== payload.nonce) return false;

    // Verify at least one signature on the tx is from publicKey
    const keypair = Keypair.fromPublicKey(publicKey);
    const txHash = tx.hash();
    for (const decoratedSig of tx.signatures) {
      try {
        if (keypair.verify(txHash, decoratedSig.signature())) return true;
      } catch { /* next */ }
    }
    return false;
  } catch {
    return false;
  }
}

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { publicKey, role, name, phone, location, signature, token } = req.body;
  if (!publicKey || !role || !name) {
    res.status(400).json({ error: 'publicKey, role, and name required' });
    return;
  }
  if (!signature || !token || !verifySignature(publicKey, token, signature)) {
    res.status(401).json({ error: 'Invalid or expired challenge. Request a new one and try again.' });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO users (public_key, role, name, phone, location)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (public_key) DO NOTHING
       RETURNING *`,
      [publicKey, role, name, phone ?? null, location ?? null],
    );
    const user = result.rows[0];
    if (!user) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }
    const authToken = jwt.sign(
      { publicKey: user.public_key, role: user.role, userId: user.id },
      JWT_SECRET,
      { expiresIn: '7d' },
    );
    await recordSession(pool, user.public_key, authToken, req);
    res.cookie('fc_token', authToken, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production' });
    res.json({ token: authToken, user: { id: user.id, publicKey: user.public_key, role: user.role, name: user.name } });
  } catch {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { publicKey, signature, token } = req.body;
  if (!publicKey) {
    res.status(400).json({ error: 'publicKey required' });
    return;
  }
  if (!signature || !token || !verifySignature(publicKey, token, signature)) {
    res.status(401).json({ error: 'Invalid or expired challenge. Request a new one and try again.' });
    return;
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE public_key = $1', [publicKey]);
    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const authToken = jwt.sign(
      { publicKey: user.public_key, role: user.role, userId: user.id },
      JWT_SECRET,
      { expiresIn: '7d' },
    );
    await recordSession(pool, user.public_key, authToken, req);
    res.cookie('fc_token', authToken, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production' });
    res.json({ token: authToken, user: { id: user.id, publicKey: user.public_key, role: user.role, name: user.name } });
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
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /auth/logout  — clears the httpOnly cookie
router.post('/logout', (_req, res: Response) => {
  res.clearCookie('fc_token', { httpOnly: true, sameSite: 'lax', path: '/' });
  res.json({ ok: true });
});

export default router;
