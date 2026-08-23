import { useEffect, useState } from 'react';
import { api, type User } from './api';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from the httpOnly cookie on first load.
  useEffect(() => {
    api.me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="shell"><p className="muted">Loading…</p></main>;

  return (
    <main className="shell">
      {user ? (
        <Dashboard user={user} onLogout={() => { void api.logout(); setUser(null); }} />
      ) : (
        <Auth onAuthed={setUser} />
      )}
    </main>
  );
}
