import { useState, type FormEvent } from 'react';
import { api, ApiError, type User } from '../api';

// A short, sensible list; users can type any IANA zone they like.
const COMMON_ZONES = [
  'Asia/Kolkata', 'UTC', 'America/New_York', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney',
];

const guessZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function Auth({ onAuthed }: { onAuthed: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [timezone, setTimezone] = useState(guessZone);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user } =
        mode === 'register'
          ? await api.register({ email, password, timezone })
          : await api.login({ email, password });
      onAuthed(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.full : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <h1>Habit Tracker</h1>
      <p className="muted">Streaks counted in your own timezone.</p>

      <div className="tabs">
        <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>
          Register
        </button>
        <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>
          Log in
        </button>
      </div>

      <form onSubmit={submit}>
        <label>
          Email
          <input type="email" value={email} required autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label>
          Password
          <input type="password" value={password} required minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            onChange={(e) => setPassword(e.target.value)} />
          {mode === 'register' && <small className="muted">At least 8 characters.</small>}
        </label>

        {mode === 'register' && (
          <label>
            Timezone
            <input list="zones" value={timezone} required
              onChange={(e) => setTimezone(e.target.value)} />
            <datalist id="zones">
              {COMMON_ZONES.map((z) => <option key={z} value={z} />)}
            </datalist>
            <small className="muted">Any IANA zone name. Your local day is decided by this.</small>
          </label>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Working…' : mode === 'register' ? 'Create account' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
