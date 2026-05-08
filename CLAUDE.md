# Dota 2 MMR Tracker — project context

A single-user (with optional guest read-only access) web app that tracks a Dota 2
player's progress toward a locked MMR goal. Defaults to account `403281874`.
Hosted on Vercel; storage on Turso (libSQL).

## Stack

- **Next.js 14** App Router + TypeScript + Tailwind CSS
- **`@libsql/client`** — same client speaks SQLite locally (`file:./data/tracker.db`)
  and Turso in prod. Single env-var swap, no code change.
- **OpenDota API** for player + match data (no auth required for free tier)
- **SWR** for client polling (player 60s, matches 30s, goal 60s)
- **Recharts** for the cumulative net-wins chart
- **Zod** for goal validation

## Project layout

```
app/
  login/page.tsx                 # password form + "Access as guest" form (server actions)
  page.tsx                       # server entry; reads role from cookie, redirects to /login if absent
  layout.tsx, globals.css
  api/
    auth/route.ts                # DELETE = clear cookie (logout)
    goal/route.ts                # GET ok for any role; POST/DELETE require isMain()
    player/[id]/route.ts         # GET player summary + W/L (cached 30s server-side)
    player/[id]/matches/route.ts # GET matches (no-store, ?days=N&limit=M)
components/
  Dashboard.tsx                  # client orchestrator; branches on role × goal-exists
  Onboarding.tsx                 # 2-step wizard (confirm MMR -> set goal); main-only
  LockedDashboard.tsx            # motivational view; accepts readOnly for guests
  MmrProgress.tsx                # SVG progress ring + start/now/target tiles
  CountdownCard.tsx              # big day count + live HH:MM:SS to midnight
  PaceCard.tsx                   # MMR/day, wins/day, since-lock-in delta
  TodayCard.tsx                  # today's net wins vs daily target
  ProgressChart.tsx              # cumulative net wins, 7d/30d/90d toggle
  MatchList.tsx                  # 12 most recent matches
lib/
  auth.ts                        # HMAC-signed cookie; Role = "main" | "guest"
  db.ts                          # libSQL client + ensureSchema (idempotent CREATE TABLE IF NOT EXISTS)
  opendota.ts                    # fetchPlayerSummary, fetchMatches({days, limit})
  calc.ts                        # project() returns GoalProjection with daily fields
  types.ts                       # Profile, PlayerSummary, Match, Goal, GoalProjection, Role
data/
  tracker.db                     # local SQLite (gitignored)
```

## Running

```bash
npm install
cp .env.example .env.local       # then edit
npm run dev                      # http://localhost:3000 -> /login
npm run build && npm run start   # production-mode locally
```

**Restart `npm run dev` after env changes** — Next reads `.env.local` only at startup.

## Environment variables

| Name | Required | Notes |
|---|---|---|
| `DEFAULT_ACCOUNT_ID` | yes | Public Steam32 account id (default `403281874`) |
| `APP_PASSWORD` | yes | Login password for the main role |
| `APP_SECRET` | yes | HMAC secret for the auth cookie. ≥32 hex chars in prod |
| `TURSO_DATABASE_URL` | prod only | `libsql://...` Without it, falls back to `file:./data/tracker.db` |
| `TURSO_AUTH_TOKEN` | prod only | Paired with `TURSO_DATABASE_URL` |
| `OPENDOTA_API_KEY` | optional | Bumps OpenDota rate limit |

`.env.local` **must be UTF-8**, not UTF-16. PowerShell's `>` redirect produces UTF-16
LE with a BOM and Next can't parse it. Use the Write tool / VSCode "Save with
Encoding: UTF-8" / `printf '...' > .env.local` from a POSIX shell.

## Auth model

Single signed cookie `d2t_auth` carries one of two roles: `main` or `guest`.

- **main** — password gate (`APP_PASSWORD`). Can do everything: onboarding,
  setting/resetting goals, viewing data.
- **guest** — no password. Read-only: can view the main user's locked dashboard
  and matches, but POST/DELETE on `/api/goal` return 403.

Cookie format: `<role>.<hmac-sha256(role, APP_SECRET)>`. HttpOnly, SameSite=Lax,
30-day expiry.

Helpers in `lib/auth.ts`: `getRole()`, `isAuthenticated()`, `isMain()`,
`setAuthCookie(role)`, `clearAuthCookie()`, `checkPassword(input)`.

Server-side gating only — never trust the client. API routes call `isMain()` for
write paths.

## Database

One table, auto-created on first read via `ensureSchema()`:

```sql
CREATE TABLE IF NOT EXISTS goals (
  account_id  INTEGER PRIMARY KEY,
  start_mmr   INTEGER NOT NULL,
  target_mmr  INTEGER NOT NULL,
  deadline    TEXT NOT NULL,         -- YYYY-MM-DD
  mmr_per_win INTEGER NOT NULL DEFAULT 25,
  created_at  TEXT NOT NULL          -- ISO-8601 UTC: strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
```

**Lock semantics**: POST `/api/goal` returns 409 if a goal already exists for the
account. The only way to change a locked goal is DELETE then POST again. This is
intentional — the dashboard displays a "Reset goal" button (main only) that
opens a confirmation modal before DELETE.

## MMR math

OpenDota's `computed_mmr` is unreliable for most accounts (Valve hides exact
MMR). The app instead **anchors** on a user-confirmed `start_mmr` at lock-in
time and adds net wins since:

```
tracked_mmr = goal.start_mmr + net_wins_since(goal.created_at) * 25
```

Constants:
- **25 MMR / ranked win** — current Valve rate. Defaulted in `goalSchema` and the
  GoalForm. Keep this 25, *not* 30.
- The `mmr_per_win` column allows overriding per goal (10–50) but there's no UI
  for it — earlier user feedback was "I shouldn't be setting it."

`project()` in `lib/calc.ts` returns a `GoalProjection` with daily-aware fields:
`mmr_per_day_needed`, `wins_per_day_needed`, `today_wins/losses/net`,
`today_target_wins`, `progress_pct`, `on_track`, `reached`. Recomputes against
`now` on every render so the per-day pace shifts as days tick by.

## OpenDota gotchas

- **Use `/players/:id/matches?date=N`** for windows up to 90 days (returns 300+
  matches for active players). Don't use `/recentMatches` — it's capped at ~20.
- The `significant=0` query param keeps turbos/non-ranked; default `1` filters
  to ranked-only. We pass `significant=0` to match the old `recentMatches`
  behavior.
- **OpenDota indexes matches with a delay** (typically 1–10 minutes after the
  game ends). The dashboard surfaces this with the "Updated X ago" timestamp
  and a "matches can take a few minutes to appear" hint when no matches have
  registered since lock-in.
- The `/matches` and `/recentMatches` endpoints both return `player_slot` and
  `radiant_win`. Win is derived as `(player_slot < 128) === radiant_win`.

## Deployment (Vercel + Turso)

1. **Turso** (one-time): `turso db create dota-tracker` (or via dashboard at
   turso.tech). Grab the URL and an auth token.
2. **Vercel env vars** (Production scope): `APP_PASSWORD`, `APP_SECRET`,
   `DEFAULT_ACCOUNT_ID`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
3. **Push to main** → Vercel auto-deploys. *Don't* use Vercel's "Redeploy"
   button to update — it rebuilds the same source as the original deployment, it
   doesn't pull HEAD.
4. **After changing env vars**, redeploy is required (env changes don't apply
   to existing builds).

## Common commands

```bash
npm run dev             # dev server with HMR
npm run build           # production build
npm run start           # serve the production build (after build)
git status -s
git log --oneline -5
```

Smoke-test API routes locally (after `npm run start`):

```bash
# Forge a signed auth cookie matching APP_SECRET to test protected routes
SIG=$(node -e 'console.log(require("crypto").createHmac("sha256","'$APP_SECRET'").update("main").digest("hex"))')
curl -H "Cookie: d2t_auth=main.$SIG" http://localhost:3000/api/player/403281874
```

## Recent decisions / lessons

- **Goal lock**: enforce server-side (POST returns 409 when a goal exists), not
  client-only. Reset = DELETE → re-onboard.
- **Matches no-store cache**: Vercel's `s-maxage` was causing 30–90s staleness;
  the matches route now sends `Cache-Control: no-store` and the OpenDota fetch
  uses `cache: "no-store"`. Player summary is still 30s-cached because rank
  doesn't change rapidly.
- **OpenDota match window**: bumped from 20 (recentMatches) to 90 days
  (/matches?date=90&limit=500). Chart has a 7d/30d/90d toggle.
- **Guest role**: `Role` lives in `lib/types.ts` (client-safe). `lib/auth.ts`
  imports `next/headers`, so don't import auth helpers from client components.
- **Server actions can't be tested with curl** — they need framework-encoded
  action IDs. To smoke-test auth-gated routes, sign a cookie manually with the
  HMAC algorithm above.
- **PowerShell `>` writes UTF-16 by default** — env files written this way silently
  break Next. Always write env files as UTF-8.

## Repo + deployed URL

- GitHub: `https://github.com/TeohYx/dota-tracker`
- Vercel preview URL pattern: `https://dota-tracker-git-main-<account>.vercel.app`
  (these branch URLs are gated by Vercel SSO for the project owner).

## Player

Default tracked: **403281874** ("Godlike\`.lft", Immortal, Malaysia).
