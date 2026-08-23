# Habit Tracker with Streaks

Track daily habits and see current/longest streaks computed strictly in **your own
IANA timezone** — never from elapsed hours.

- **Frontend:** React 19 + TypeScript (Vite)
- **Backend:** Node.js + Express
- **Database:** MongoDB + Mongoose
- **Auth:** bcrypt password hashing + JWT in an httpOnly cookie
- **Validation:** zod at every route boundary

---

## Where the local-day logic lives

**[`server/src/lib/localDay.js`](server/src/lib/localDay.js)** — one file, no
database or HTTP imports, fully unit tested. Everything timezone-related lives
there and nowhere else.

The core decision: **a check-in is a calendar day, not an instant.** We persist
`localDay` as a plain `"YYYY-MM-DD"` string resolved in the user's timezone at
write time. As a result:

- Streak math is pure calendar-date arithmetic — DST shifts, leap days, and the
  server's own timezone cannot affect it.
- "Is this a duplicate?" becomes a unique index on `(habitId, localDay)`, enforced
  by the database rather than by application logic.
- "Is this the future?" is a string comparison against the user's current local
  day, which is exact for zero-padded ISO dates.

Storing a UTC timestamp instead would force every read to re-derive the local day
and would make the uniqueness constraint impossible to express in an index.

### Streak rules

- `currentStreak` counts consecutive days backwards from the latest check-in, but
  only if that check-in is **today or yesterday** — so a day still in progress
  doesn't zero out a live streak.
- `longestStreak` is the longest consecutive run in the habit's whole history.

---

## Setup

**Prerequisites:** Node 20+ and a running MongoDB.

```bash
brew trust mongodb/brew && brew install mongodb-community && brew services start mongodb-community
```

(Or point `MONGODB_URI` at a MongoDB Atlas cluster.)

```bash
git clone <this-repo> && cd habit-tracker
npm run install:all
cp server/.env.example server/.env   # then set JWT_SECRET
```

`server/.env`:

| Variable        | Example                                        |
| --------------- | ---------------------------------------------- |
| `MONGODB_URI`   | `mongodb://127.0.0.1:27017/habit-tracker`      |
| `JWT_SECRET`    | any long random string (`openssl rand -hex 32`) |
| `PORT`          | `4000`                                          |
| `CLIENT_ORIGIN` | `http://localhost:5173`                         |

Run both processes in separate terminals:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

Open http://localhost:5173. Vite proxies `/api` to the backend, so the auth
cookie is same-origin in development.

### Tests

```bash
npm test
```

Covers timezone boundaries, future-date rejection, DST transitions, gap handling,
and the today-vs-yesterday rule.

### Migrations

MongoDB is schemaless, so there are no migration files. The unique indexes are
declared on the schemas and applied at boot via `mongoose.syncIndexes()`
(`server/src/index.js`) — the constraints are versioned with the code.

---

## API

All habit routes require the session cookie. Errors are always
`{ "error": string, "details"?: [{ field, message }] }`.

| Method   | Route                                | Purpose                                   |
| -------- | ------------------------------------ | ----------------------------------------- |
| `POST`   | `/api/auth/register`                 | `{ email, password, timezone }`           |
| `POST`   | `/api/auth/login`                    | `{ email, password }`                     |
| `POST`   | `/api/auth/logout`                   | Clears the cookie                         |
| `GET`    | `/api/auth/me`                       | Current user + their local day            |
| `GET`    | `/api/habits`                        | Dashboard: habits with streaks            |
| `POST`   | `/api/habits`                        | `{ name }`                                |
| `DELETE` | `/api/habits/:id`                    | Delete habit and its check-ins            |
| `POST`   | `/api/habits/:id/checkins`           | `{ date? }` — omit for today, or backfill |
| `DELETE` | `/api/habits/:id/checkins/:localDay` | Undo a check-in                           |

### Validation & error cases

| Case                             | Status | Message                                                       |
| -------------------------------- | ------ | ------------------------------------------------------------- |
| Check-in dated after local today | `400`  | `date 2026-08-24 is in the future; your local day is 2026-08-23` |
| Malformed date                   | `400`  | `date must be in YYYY-MM-DD format`                           |
| Duplicate local day              | `409`  | `Already checked in for 2026-08-23 in Asia/Kolkata`           |
| Duplicate habit name             | `409`  | `You already have a habit called "Read"`                      |
| Invalid IANA timezone            | `400`  | `timezone must be a valid IANA timezone, e.g. Asia/Kolkata`   |
| Password under 8 characters      | `400`  | `password must be at least 8 characters`                      |
| Wrong credentials                | `401`  | `Incorrect email or password` (identical for unknown emails)  |
| Another user's habit             | `404`  | `Habit not found`                                             |

---

## Data model

```
User    { email (unique), passwordHash, timezone }
Habit   { userId, name }                      unique (userId, name)
CheckIn { habitId, userId, localDay }         unique (habitId, localDay)
```

`CheckIn.createdAtUtc` records when the row was written — useful for auditing
backfills, and deliberately never used in streak math.

## Notes and trade-offs

- Timezone is set at registration, matching the spec's "assigned IANA timezone".
  Changing it later would keep all stored `localDay` values as-is: they record
  the day the user *was* living in, which is the honest interpretation.
- The dashboard sends `recentDays` (last 60 days) per habit so the heatmap
  renders without extra round-trips. At much larger scale this would page.
- Streaks are computed on read rather than cached. Correct by construction, and
  cheap at this data volume.
