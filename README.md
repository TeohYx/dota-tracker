# Dota 2 MMR Tracker

Track a Dota 2 player's MMR progress against a deadline. The app pulls live data
from [OpenDota](https://www.opendota.com), lets you set a target MMR + deadline,
and tells you the **net wins per day** you need to reach the goal.

Default tracked account: `403281874` (Godlike`.lft). Change it in the UI or via
the `DEFAULT_ACCOUNT_ID` env var.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** for the UI
- **libSQL / SQLite** via `@libsql/client` — local file in dev, Turso in prod
- **OpenDota** public API for player + match data
- **SWR** polls every 60s so the dashboard stays fresh

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

A local SQLite DB is created at `data/tracker.db` on first request. No setup
needed.

## Production database (one option among many)

For Vercel-style serverless deploys you need a hosted DB. The cheapest path
is [Turso](https://turso.tech) (free tier, ~no setup):

```bash
turso db create dota-tracker
turso db show dota-tracker --url     # -> TURSO_DATABASE_URL
turso db tokens create dota-tracker  # -> TURSO_AUTH_TOKEN
```

Set both as env vars in your hosting provider. The same code path works locally
(file:) and in production (libsql://).

## Deploy

The app is a stock Next.js project — any Node host works. Two easy paths:

### Vercel (recommended)

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Add env vars: `DEFAULT_ACCOUNT_ID`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
4. Click Deploy. Vercel gives you a `*.vercel.app` URL.

### Railway

1. Push to GitHub.
2. New project → Deploy from GitHub.
3. Set the same env vars. Railway has a persistent disk on its free tier, so
   you can skip Turso and let SQLite live on `/data`.

## How the math works

- "Net wins" = wins − losses.
- Each ranked net win shifts you ~30 MMR (Valve's published rate). Configurable
  in the goal form.
- `wins_remaining = ceil((target_mmr − current_mmr) / mmr_per_win)`
- `wins_per_day = wins_remaining / days_to_deadline`
- "On track" compares your net wins since the goal was set against a linear pace.

The displayed MMR is OpenDota's `computed_mmr` when available, otherwise a
midpoint derived from `rank_tier`. Valve hides exact MMR for most accounts, so
treat the number as a reasonable estimate, not a leaderboard query.

## Project layout

```
app/
  api/
    player/[id]/route.ts          # GET player summary + W/L
    player/[id]/matches/route.ts  # GET recent matches
    goal/route.ts                 # GET/POST/DELETE the goal
  page.tsx                        # server entry — passes default account id
  layout.tsx, globals.css
components/
  Dashboard.tsx                   # client root, owns SWR data
  StatsCards.tsx                  # 4-up summary
  GoalForm.tsx                    # set/update/clear goal
  ProjectionPanel.tsx             # the wins/day calculation
  MatchList.tsx                   # last 12 matches
  ProgressChart.tsx               # cumulative net-wins area chart
lib/
  opendota.ts                     # API client + rank/MMR mapping
  db.ts                           # libSQL client + schema
  calc.ts                         # projection math
  types.ts
```

## Notes / limitations

- OpenDota's `recentMatches` endpoint returns the last ~20 ranked matches.
  Older history needs `/players/{id}/matches?limit=...` (drop-in upgrade if
  you want a longer chart window).
- The free OpenDota tier is rate-limited to 60 requests/minute and 2,000/day.
  Set `OPENDOTA_API_KEY` if you hit the cap.
- The tracker stores one goal per `account_id`. Re-saving overwrites.
