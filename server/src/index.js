import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import habitRoutes from './routes/habits.js';
import { errorHandler } from './middleware/errors.js';

const { MONGODB_URI, JWT_SECRET, PORT = 4000, CLIENT_ORIGIN = 'http://localhost:5173' } = process.env;

if (!MONGODB_URI || !JWT_SECRET) {
  console.error('Missing MONGODB_URI or JWT_SECRET. Copy .env.example to .env first.');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

await mongoose.connect(MONGODB_URI);
// Builds the unique indexes (habit name per user, one check-in per local day).
await mongoose.syncIndexes();
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
