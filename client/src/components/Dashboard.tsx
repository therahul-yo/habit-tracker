import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Dashboard as DashboardData, type User } from '../api';
import { HabitCard } from './HabitCard';

export function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.dashboard());
    } catch (err) {
      setError(err instanceof ApiError ? err.full : 'Could not load habits');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** Every mutation runs through here so errors surface consistently. */
  async function run(fn: () => Promise<unknown>) {
    setError('');
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.full : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function addHabit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    void run(async () => { await api.createHabit(trimmed); setName(''); });
  }

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <h1>Habit Tracker</h1>
          <p className="muted">
            {user.email} · {data?.timezone ?? user.timezone} · today is{' '}
            <strong>{data?.today ?? user.today}</strong>
          </p>
        </div>
        <button className="ghost" onClick={onLogout}>Log out</button>
      </header>

      <form className="new-habit" onSubmit={addHabit}>
        <input value={name} placeholder="New habit, e.g. Read 20 pages" maxLength={80}
          onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="primary" disabled={busy || !name.trim()}>Add habit</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {!data ? (
        <p className="muted">Loading…</p>
      ) : data.habits.length === 0 ? (
        <p className="muted empty">No habits yet. Add your first one above.</p>
      ) : (
        <div className="habits">
          {data.habits.map((habit) => (
            <HabitCard key={habit.id} habit={habit} today={data.today} busy={busy}
              onCheckIn={(id, date) => void run(() => api.checkIn(id, date))}
              onUndo={(id, day) => void run(() => api.undoCheckIn(id, day))}
              onDelete={(id) => void run(() => api.deleteHabit(id))} />
          ))}
        </div>
      )}
    </div>
  );
}
