import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import userRoutes from './routes/users';
import disputeRoutes from './routes/disputes';
import receiptRoutes from './routes/receipts';

const app = express();
const PORT = process.env.PORT ?? 4000;

const allowedOrigins = [
  process.env.FRONTEND_URL ?? 'http://localhost:5173',
  /^http:\/\/localhost:\d+$/,   // any localhost port in dev
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);  // curl / server-to-server
    const ok = allowedOrigins.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    cb(ok ? null : new Error(`CORS: ${origin} not allowed`), ok);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/users', userRoutes);
app.use('/disputes', disputeRoutes);
app.use('/receipts', receiptRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`FarmChain API running on port ${PORT}`);
});
