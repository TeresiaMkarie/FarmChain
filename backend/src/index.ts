import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import userRoutes from './routes/users';
import disputeRoutes from './routes/disputes';
import receiptRoutes from './routes/receipts';
import notificationRoutes from './routes/notifications';
import reviewRoutes from './routes/reviews';
import adminRoutes from './routes/admin';
import wishlistRoutes from './routes/wishlist';
import messageRoutes from './routes/messages';
import recurringRoutes from './routes/recurring';

// S1: Fail fast if JWT secret is missing or too short to be secure
const JWT_SECRET = process.env.JWT_SECRET ?? '';
if (JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters. Set a strong secret in .env');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1) ;
const PORT = process.env.PORT ?? 4000;
const IS_PROD = process.env.NODE_ENV === 'production';

// S3: In production only allow the configured frontend origin; in dev allow any localhost port
const allowedOrigins: (string | RegExp)[] = IS_PROD
  ? [process.env.FRONTEND_URL!]
  : [process.env.FRONTEND_URL ?? 'https://farm-chain-49co.vercel.app', /^http:\/\/localhost:\d+$/];

// S5: Security headers (CSP, X-Frame-Options, HSTS, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://ipfs.io', 'https://gateway.pinata.cloud'],
      connectSrc: ["'self'", 'https://horizon-testnet.stellar.org', 'https://horizon.stellar.org'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);  // curl / server-to-server
    const ok = allowedOrigins.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    cb(null, ok);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// S4: Rate limit auth endpoints — 20 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use(cookieParser());
app.use(express.json());

// Static files (avatars, product images) must be loadable cross-origin by the React frontend.
// Helmet sets Cross-Origin-Resource-Policy: same-origin globally; override it here.
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../../uploads')));

app.use('/auth', authLimiter, authRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/users', userRoutes);
app.use('/disputes', disputeRoutes);
app.use('/receipts', receiptRoutes);
app.use('/notifications', notificationRoutes);
app.use('/reviews', reviewRoutes);
app.use('/admin', adminRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/messages', messageRoutes);
app.use('/recurring', recurringRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`FarmChain API running on port ${PORT}`);
});

