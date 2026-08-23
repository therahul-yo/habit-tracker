import { useState } from 'react';
import type { Habit } from '../api';

/** The last `count` local days ending at `today`, oldest first. */
function trailingDays(today: string, count: number): string[] {
  const [y, m, d] = today.split('-').map(Number);
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    // UTC arithmetic on a bare calendar date — no timezone involved here.
    const dt = new Date(Date.UTC(y, m - 1, d - i));
    days.push(dt.toISOString().slice(0, 10));
  }
  return days;
}

type Props = {
  habit: Habit;
  today: string;
  onCheckIn: (id: string, date?: string) => void;
  onUndo: (id: string, localDay: string) => void;
  onDelete: (id: string) => void;
  busy: boolean;
};

export function HabitCard({ habit, today, onCheckIn, onUndo, onDelete, busy }: Props) {
  const [backfill, setBackfill] = useState('');
  const done = new Set(habit.recentDays);

  return (
    <article className="card">
      <header>
        <h3>{habit.name}</h3>
        <button className="ghost danger" onClick={() => onDelete(habit.id)} disabled={busy}
          aria-label={`Delete ${habit.name}`}>×</button>
      </header>

      <div className="stats">
        <div><strong>{habit.currentStreak}</strong><span>current streak</span></div>
        <div><strong>{habit.longestStreak}</strong><span>longest streak</span></div>
        <div><strong>{habit.totalCheckIns}</strong><span>total</span></div>
      </div>

      <div className="grid" aria-label="Last 28 local days">
        {trailingDays(today, 28).map((day) => (
          <span key={day} title={day}
            className={`cell${done.has(day) ? ' on' : ''}${day === today ? ' today' : ''}`} />
        ))}
      </div>

      <div className="actions">
        {habit.checkedInToday ? (
          <button className="ghost" onClick={() => onUndo(habit.id, today)} disabled={busy}>
            ✓ Done today — undo
          </button>
        ) : (
          <button className="primary" onClick={() => onCheckIn(habit.id)} disabled={busy}>
            Check in today
          </button>
        )}
      </div>

      <details>
        <summary>Backfill a missed day</summary>
        <div className="backfill">
          <input type="date" max={today} value={backfill}
            onChange={(e) => setBackfill(e.target.value)} />
          <button className="ghost" disabled={!backfill || busy}
            onClick={() => { onCheckIn(habit.id, backfill); setBackfill(''); }}>
            Add
          </button>
        </div>
        <small className="muted">Future dates are rejected — your local day is {today}.</small>
      </details>
    </article>
  );
}
