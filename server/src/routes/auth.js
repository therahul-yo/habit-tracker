import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import { isValidTimezone, todayLocalDay } from '../lib/localDay.js';
import { wrap, httpError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('must be a valid email address'),
  password: z.string().min(8, 'must be at least 8 characters'),
  timezone: z.string().refine(isValidTimezone, 'must be a valid IANA timezone, e.g. Asia/Kolkata'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'is required'),
});

function setSession(res, user) {
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  timezone: user.timezone,
  today: todayLocalDay(user.timezone),
});

router.post('/register', wrap(async (req, res) => {
  const { email, password, timezone } = registerSchema.parse(req.body);
  if (await User.exists({ email: email.toLowerCase() })) {
    throw httpError(409, 'An account with that email already exists');
  }
  const user = await User.create({
    email,
    passwordHash: await bcrypt.hash(password, 12),
    timezone,
  });
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
}));

router.post('/login', wrap(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() });
  // Same message either way, so we don't leak which emails are registered.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw httpError(401, 'Incorrect email or password');
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
}));

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
