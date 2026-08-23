export type User = { id: string; email: string; timezone: string; today: string };

export type Habit = {
  id: string;
  name: string;
  createdAt: string;
  totalCheckIns: number;
  checkedInToday: boolean;
  recentDays: string[];
  currentStreak: number;
  longestStreak: number;
};

export type Dashboard = { today: string; timezone: string; habits: Habit[] };

export class ApiError extends Error {
  details?: { field: string; message: string }[];
  constructor(message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.details = details;
  }
  /** Flattens field-level validation errors into one readable line. */
  get full(): string {
    if (!this.details?.length) return this.message;
    return this.details.map((d) => `${d.field} ${d.message}`).join(', ');
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, body.details);
  return body as T;
}

const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const api = {
  me: () => request<{ user: User }>('/auth/me'),
  register: (b: { email: string; password: string; timezone: string }) =>
    post<{ user: User }>('/auth/register', b),
  login: (b: { email: string; password: string }) => post<{ user: User }>('/auth/login', b),
  logout: () => post<{ ok: true }>('/auth/logout'),

  dashboard: () => request<Dashboard>('/habits'),
  createHabit: (name: string) => post<unknown>('/habits', { name }),
  deleteHabit: (id: string) => request<unknown>(`/habits/${id}`, { method: 'DELETE' }),
  checkIn: (id: string, date?: string) => post<unknown>(`/habits/${id}/checkins`, { date }),
  undoCheckIn: (id: string, localDay: string) =>
    request<unknown>(`/habits/${id}/checkins/${localDay}`, { method: 'DELETE' }),
};
