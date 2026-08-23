import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';
import {
  todayLocalDay, resolveCheckInDay, computeStreaks, addDays, isValidTimezone,
  parseLocalDay, daysBetween,
} from './localDay.js';

const at = (iso) => DateTime.fromISO(iso, { zone: 'utc' });

test('local day depends on timezone, not UTC', () => {
  // 2026-08-23T19:00Z is already Aug 24 in Kolkata (+05:30), still Aug 23 in NY.
  const now = at('2026-08-23T19:00:00Z');
  assert.equal(todayLocalDay('Asia/Kolkata', now), '2026-08-24');
  assert.equal(todayLocalDay('America/New_York', now), '2026-08-23');
});

test('future date is rejected relative to the user local day', () => {
  const now = at('2026-08-23T19:00:00Z');
  // Aug 24 is "today" in Kolkata but the future in New York.
  assert.equal(resolveCheckInDay('2026-08-24', 'Asia/Kolkata', now).ok, true);
  assert.equal(resolveCheckInDay('2026-08-24', 'America/New_York', now).ok, false);
});

test('omitted date defaults to today, malformed date rejected', () => {
  const now = at('2026-08-23T19:00:00Z');
  assert.equal(resolveCheckInDay(undefined, 'Asia/Kolkata', now).localDay, '2026-08-24');
  assert.equal(resolveCheckInDay('23-08-2026', 'Asia/Kolkata', now).ok, false);
});

test('streak is calendar-day based, not hours elapsed', () => {
  const now = at('2026-08-23T12:00:00Z');
  const tz = 'Asia/Kolkata';
  // Two check-ins ~2 hours apart in real time but on different local days.
  const s = computeStreaks(['2026-08-22', '2026-08-23'], tz, now);
  assert.deepEqual(s, { currentStreak: 2, longestStreak: 2 });
});

test('a gap breaks the current streak but keeps the longest', () => {
  const now = at('2026-08-23T12:00:00Z');
  const days = ['2026-08-10','2026-08-11','2026-08-12','2026-08-13','2026-08-22','2026-08-23'];
  assert.deepEqual(computeStreaks(days, 'Asia/Kolkata', now),
    { currentStreak: 2, longestStreak: 4 });
});

test('yesterday-only still counts as a live streak (today in progress)', () => {
  const now = at('2026-08-23T12:00:00Z');
  assert.equal(computeStreaks(['2026-08-21','2026-08-22'], 'Asia/Kolkata', now).currentStreak, 2);
});

test('stale streak resets to zero', () => {
  const now = at('2026-08-23T12:00:00Z');
  assert.equal(computeStreaks(['2026-08-20','2026-08-21'], 'Asia/Kolkata', now).currentStreak, 0);
});

test('DST transition does not break a streak', () => {
  // US spring-forward 2026-03-08: that local day is only 23 hours long.
  const now = at('2026-03-09T17:00:00Z');
  const s = computeStreaks(['2026-03-07','2026-03-08','2026-03-09'], 'America/New_York', now);
  assert.deepEqual(s, { currentStreak: 3, longestStreak: 3 });
});

test('parseLocalDay anchors to a DST-free zone', () => {
  // Luxon's diff(..., 'days') is calendar-aware and would return 1 in any zone,
  // so the test above passes with or without the UTC anchor. This asserts the
  // stronger property the anchor actually buys: the two instants are a flat
  // 24 hours apart across a spring-forward boundary, so even plain millisecond
  // arithmetic is exactly one day. That is what stops a future rewrite of
  // daysBetween from silently breaking one day a year.
  const a = parseLocalDay('2026-03-08'); // US spring-forward
  const b = parseLocalDay('2026-03-09');
  assert.equal(a.offset, b.offset);
  assert.equal((b.toMillis() - a.toMillis()) / 86_400_000, 1);
  assert.equal(daysBetween('2026-03-08', '2026-03-09'), 1);
});

test('results do not depend on the process timezone', () => {
  // Every function takes its zone explicitly, so the machine's own TZ must not
  // leak in. Checked at the extremes of the offset range (UTC+14 and UTC-11).
  const mod = fileURLToPath(new URL('./localDay.js', import.meta.url));
  const probe = `
    const { todayLocalDay, computeStreaks, resolveCheckInDay, daysBetween } =
      await import(${JSON.stringify(mod)});
    const { DateTime } = await import('luxon');
    const now = DateTime.fromISO('2026-08-23T19:00:00Z', { zone: 'utc' });
    console.log(JSON.stringify([
      todayLocalDay('Asia/Kolkata', now),
      todayLocalDay('America/New_York', now),
      resolveCheckInDay('2026-08-24', 'America/New_York', now).ok,
      computeStreaks(['2026-03-07','2026-03-08','2026-03-09'], 'America/New_York', now),
      daysBetween('2026-02-28', '2026-03-01'),
    ]));
  `;
  const run = (tz) =>
    execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
      env: { ...process.env, TZ: tz },
      encoding: 'utf8',
    }).trim();

  const expected = run('UTC');
  for (const tz of ['Pacific/Kiritimati', 'Pacific/Niue', 'America/New_York']) {
    assert.equal(run(tz), expected, `output differs under TZ=${tz}`);
  }
});

test('empty history', () => {
  assert.deepEqual(computeStreaks([], 'UTC', at('2026-08-23T00:00:00Z')),
    { currentStreak: 0, longestStreak: 0 });
});

test('helpers', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01'); // 2026 is not a leap year
  assert.equal(isValidTimezone('Asia/Kolkata'), true);
  assert.equal(isValidTimezone('Mars/Phobos'), false);
});
