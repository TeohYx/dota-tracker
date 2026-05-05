import type { Goal, GoalProjection, Match } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  return Math.max(0, Math.ceil((b - a) / MS_PER_DAY));
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function project(goal: Goal, currentMmr: number, recent: Match[]): GoalProjection {
  const nowIso = new Date().toISOString();
  const deadlineIso = `${goal.deadline}T23:59:59Z`;

  const days_remaining = daysBetween(nowIso, deadlineIso);
  const mmr_remaining = Math.max(0, goal.target_mmr - currentMmr);
  const wins_remaining = Math.ceil(mmr_remaining / goal.mmr_per_win);
  const reached = currentMmr >= goal.target_mmr;

  const mmr_per_day_needed = days_remaining > 0
    ? +(mmr_remaining / days_remaining).toFixed(2)
    : mmr_remaining;
  const wins_per_day_needed = days_remaining > 0
    ? +(wins_remaining / days_remaining).toFixed(2)
    : wins_remaining;

  // Net wins since the goal was created (matches with start_time >= goal.created_at)
  const goalStartMs = new Date(goal.created_at).getTime();
  const since = recent.filter(m => m.start_time * 1000 >= goalStartMs);
  const net_wins_so_far = since.reduce((acc, m) => acc + (m.win ? 1 : -1), 0);

  // Linear-pace expectation
  const totalDays = daysBetween(goal.created_at, deadlineIso) || 1;
  const totalWinsNeeded = Math.max(
    0,
    Math.ceil((goal.target_mmr - goal.start_mmr) / goal.mmr_per_win)
  );
  const daysElapsed = Math.max(0, totalDays - days_remaining);
  const expected_net_wins_so_far = +((totalWinsNeeded * daysElapsed) / totalDays).toFixed(2);
  const on_track = reached || net_wins_so_far >= Math.floor(expected_net_wins_so_far);

  const totalMmrToGain = Math.max(1, goal.target_mmr - goal.start_mmr);
  const gained = Math.max(0, currentMmr - goal.start_mmr);
  const progress_pct = Math.max(0, Math.min(100, Math.round((gained / totalMmrToGain) * 100)));

  // Today's matches
  const todayMs = startOfTodayMs();
  const today = recent.filter(m => m.start_time * 1000 >= todayMs);
  const today_wins = today.filter(m => m.win).length;
  const today_losses = today.length - today_wins;
  const today_net = today_wins - today_losses;
  const today_target_wins = reached ? 0 : Math.max(1, Math.ceil(wins_per_day_needed));
  const today_complete = reached || today_net >= today_target_wins;

  return {
    goal,
    current_mmr: currentMmr,
    mmr_remaining,
    wins_remaining,
    days_remaining,
    mmr_per_day_needed,
    wins_per_day_needed,
    net_wins_so_far,
    expected_net_wins_so_far,
    progress_pct,
    on_track,
    reached,
    today_wins,
    today_losses,
    today_net,
    today_target_wins,
    today_complete
  };
}

export type DailyBucket = { date: string; wins: number; losses: number; net: number };

export function bucketByDay(matches: Match[]): DailyBucket[] {
  const buckets = new Map<string, DailyBucket>();
  for (const m of matches) {
    const date = new Date(m.start_time * 1000).toISOString().slice(0, 10);
    const b = buckets.get(date) ?? { date, wins: 0, losses: 0, net: 0 };
    if (m.win) b.wins++; else b.losses++;
    b.net = b.wins - b.losses;
    buckets.set(date, b);
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}
