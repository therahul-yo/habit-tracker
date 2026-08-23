/**
 * ALL timezone-aware "local day" logic lives in this file.
 *
 * Core idea: a check-in is not a moment in time, it is a *calendar day in the
 * user's timezone*. We therefore persist a plain `YYYY-MM-DD` string (the local
 * day) rather than a UTC timestamp. Streaks are then pure calendar-date
 * arithmetic and never depend on elapsed hours, DST shifts, or server timezone.
 */
import { DateTime } from 'luxon';

export const LOCAL_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Is this a real IANA zone name? */
export function isValidTimezone(tz) {
  return typeof tz === 'string' && DateTime.local().setZone(tz).isValid;
}

/** The user's *current* local day, e.g. "2026-08-23". */
export function todayLocalDay(timezone, now = DateTime.utc()) {
  return now.setZone(timezone).toFormat('yyyy-MM-dd');
}

/** Parse a "YYYY-MM-DD" string as a calendar date. Returns null if malformed. */
export function parseLocalDay(localDay) {
  if (!LOCAL_DAY_RE.test(localDay ?? '')) return null;
  const dt = DateTime.fromFormat(localDay, 'yyyy-MM-dd', { zone: 'utc' });
  return dt.isValid ? dt : null;
}

/** Whole calendar days between two local-day strings (b - a). */
export function daysBetween(a, b) {
  return parseLocalDay(b).diff(parseLocalDay(a), 'days').days;
}

/** Shift a local-day string by n calendar days. */
export function addDays(localDay, n) {
  return parseLocalDay(localDay).plus({ days: n }).toFormat('yyyy-MM-dd');
}

/**
 * Validate a requested check-in day against the user's timezone.
 * Returns { ok: true, localDay } or { ok: false, error }.
 * Omitting `requested` means "today".
 */
export function resolveCheckInDay(requested, timezone, now = DateTime.utc()) {
  const today = todayLocalDay(timezone, now);
  if (requested === undefined || requested === null || requested === '') {
    return { ok: true, localDay: today };
  }
  const parsed = parseLocalDay(requested);
  if (!parsed) {
    return { ok: false, error: 'date must be a calendar date in YYYY-MM-DD format' };
  }
  if (requested > today) {
    // String compare is safe and exact for zero-padded ISO dates.
    return {
      ok: false,
      error: `date ${requested} is in the future; your local day is ${today}`,
    };
  }
  return { ok: true, localDay: requested };
}

/**
 * Streaks from a set of local-day strings.
 *
 * currentStreak counts back from today (or yesterday, so a day still in
 * progress does not break an otherwise live streak).
 * longestStreak is the longest run of consecutive calendar days ever.
 */
export function computeStreaks(localDays, timezone, now = DateTime.utc()) {
  const days = [...new Set(localDays)].sort();
  if (days.length === 0) return { currentStreak: 0, longestStreak: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const today = todayLocalDay(timezone, now);
  const last = days[days.length - 1];
  const gap = daysBetween(last, today);

  let current = 0;
  if (gap === 0 || gap === 1) {
    // Walk backwards from the most recent check-in.
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (daysBetween(days[i - 1], days[i]) === 1) current++;
      else break;
    }
  }

  return { currentStreak: current, longestStreak: longest };
}
