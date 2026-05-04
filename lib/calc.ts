import type { Goal, GoalProjection, Match } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  return Math.max(0, Math.ceil((b - a) / MS_PER_DAY));
}

export function project(goal: Goal, currentMmr: number, recent: Match[]): GoalProjection {
  const today = new Date();
  const todayIso = today.toISOString();
  const days_remaining = daysBetween(todayIso, `${goal.deadline}T23:59:59Z`);
  const mmr_remaining = Math.max(0, goal.target_mmr - currentMmr);
  const wins_remaining = Math.ceil(mmr_remaining / goal.mmr_per_win);
  const net_wins_per_day = days_remaining > 0
    ? +(wins_remaining / days_remaining).toFixed(2)
    : wins_remaining;

  // Net wins since goal was created (matches with start_time >= goal.created_at)
  const goalStartMs = new Date(goal.created_at).getTime();
  const since = recent.filter(m => m.start_time * 1000 >= goalStartMs);
  const net_wins_so_far = since.reduce((acc, m) => acc + (m.win ? 1 : -1), 0);

  // Expected pace based on days elapsed since goal creation.
  const totalDays = daysBetween(goal.created_at, `${goal.deadline}T23:59:59Z`) || 1;
  const totalWinsNeeded = Math.ceil((goal.target_mmr - goal.start_mmr) / goal.mmr_per_win);
  const daysElapsed = Math.max(0, totalDays - days_remaining);
  const expected_net_wins_so_far = +((totalWinsNeeded * daysElapsed) / totalDays).toFixed(2);
  const on_track = net_wins_so_far >= Math.floor(expected_net_wins_so_far);

  return {
    goal,
    current_mmr: currentMmr,
    mmr_remaining,
    wins_remaining,
    days_remaining,
    net_wins_per_day,
    on_track,
    net_wins_so_far,
    expected_net_wins_so_far
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
