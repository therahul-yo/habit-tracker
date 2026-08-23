import { Router } from 'express';
import { z } from 'zod';
import Habit from '../models/Habit.js';
import CheckIn from '../models/CheckIn.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap, httpError } from '../middleware/errors.js';
import { resolveCheckInDay, computeStreaks, todayLocalDay, LOCAL_DAY_RE } from '../lib/localDay.js';

const router = Router();
router.use(requireAuth);

const habitSchema = z.object({
  name: z.string().trim().min(1, 'is required').max(80, 'must be 80 characters or fewer'),
});

const checkInSchema = z.object({
  // Omit for "today"; supply a past local day to backfill.
  date: z.string().regex(LOCAL_DAY_RE, 'must be in YYYY-MM-DD format').optional(),
});

/** Load a habit the caller owns, or 404. */
async function ownedHabit(req) {
  const habit = await Habit.findOne({ _id: req.params.id, userId: req.user.id }).catch(() => null);
  if (!habit) throw httpError(404, 'Habit not found');
  return habit;
}

/** GET /api/habits — dashboard: every habit with its streaks. */
router.get('/', wrap(async (req, res) => {
  const { timezone } = req.user;
  const today = todayLocalDay(timezone);

  const habits = await Habit.find({ userId: req.user.id }).sort({ createdAt: 1 });
  const checkIns = await CheckIn.find({ userId: req.user.id }).select('habitId localDay');

  const byHabit = new Map(habits.map((h) => [h.id, []]));
  for (const c of checkIns) byHabit.get(String(c.habitId))?.push(c.localDay);

  res.json({
    today,
    timezone,
    habits: habits.map((h) => {
      const days = byHabit.get(h.id) ?? [];
      return {
        id: h.id,
        name: h.name,
        createdAt: h.createdAt,
        totalCheckIns: days.length,
        checkedInToday: days.includes(today),
        recentDays: [...days].sort().slice(-60),
        ...computeStreaks(days, timezone),
      };
    }),
  });
}));

/** POST /api/habits */
router.post('/', wrap(async (req, res) => {
  const { name } = habitSchema.parse(req.body);
  if (await Habit.exists({ userId: req.user.id, name })) {
    throw httpError(409, `You already have a habit called "${name}"`);
  }
  const habit = await Habit.create({ userId: req.user.id, name });
  res.status(201).json({ habit: { id: habit.id, name: habit.name, createdAt: habit.createdAt } });
}));

/** DELETE /api/habits/:id */
router.delete('/:id', wrap(async (req, res) => {
  const habit = await ownedHabit(req);
  await CheckIn.deleteMany({ habitId: habit.id });
  await habit.deleteOne();
  res.json({ ok: true });
}));

/** POST /api/habits/:id/checkins — check in today, or backfill a past day. */
router.post('/:id/checkins', wrap(async (req, res) => {
  const habit = await ownedHabit(req);
  const { date } = checkInSchema.parse(req.body);
  const { timezone } = req.user;

  const resolved = resolveCheckInDay(date, timezone);
  if (!resolved.ok) throw httpError(400, resolved.error);
  const { localDay } = resolved;

  if (await CheckIn.exists({ habitId: habit.id, localDay })) {
    throw httpError(409, `Already checked in for ${localDay} in ${timezone}`);
  }

  try {
    await CheckIn.create({ habitId: habit.id, userId: req.user.id, localDay });
  } catch (err) {
    // Lost a race against a concurrent request; the unique index is the real guard.
    if (err?.code === 11000) throw httpError(409, `Already checked in for ${localDay} in ${timezone}`);
    throw err;
  }

  const days = (await CheckIn.find({ habitId: habit.id }).select('localDay')).map((c) => c.localDay);
  res.status(201).json({ localDay, ...computeStreaks(days, timezone) });
}));

/** DELETE /api/habits/:id/checkins/:localDay — undo a check-in. */
router.delete('/:id/checkins/:localDay', wrap(async (req, res) => {
  const habit = await ownedHabit(req);
  const { localDay } = req.params;
  if (!LOCAL_DAY_RE.test(localDay)) throw httpError(400, 'date must be in YYYY-MM-DD format');

  const deleted = await CheckIn.findOneAndDelete({ habitId: habit.id, localDay });
  if (!deleted) throw httpError(404, `No check-in recorded for ${localDay}`);

  const days = (await CheckIn.find({ habitId: habit.id }).select('localDay')).map((c) => c.localDay);
  res.json({ localDay, ...computeStreaks(days, req.user.timezone) });
}));

export default router;
