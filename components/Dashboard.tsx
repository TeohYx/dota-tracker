"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { Goal, Match, PlayerSummary, Role } from "@/lib/types";
import { project } from "@/lib/calc";
import Onboarding from "./Onboarding";
import LockedDashboard from "./LockedDashboard";
import MatchList from "./MatchList";
import ProgressChart from "./ProgressChart";

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
});

export default function Dashboard({ accountId, role }: { accountId: number; role: Role }) {
  const [refreshedAt, setRefreshedAt] = useState<number>(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const isGuest = role === "guest";

  const { data: player, error: playerErr, isLoading: playerLoading, mutate: refetchPlayer } =
    useSWR<PlayerSummary>(`/api/player/${accountId}`, fetcher, {
      refreshInterval: 60_000,
      onSuccess: () => setRefreshedAt(Date.now())
    });

  const { data: matches, mutate: refetchMatches } =
    useSWR<Match[]>(`/api/player/${accountId}/matches?days=90&limit=500`, fetcher, {
      refreshInterval: 30_000,
      onSuccess: () => setRefreshedAt(Date.now())
    });

  const { data: goal, mutate: refetchGoal } =
    useSWR<Goal | null>(`/api/goal?account_id=${accountId}`, fetcher, { refreshInterval: 60_000 });

  const { trackedMmr, matchesSinceLockIn } = useMemo(() => {
    if (!goal) return { trackedMmr: player?.derived_mmr ?? 0, matchesSinceLockIn: 0 };
    const goalStartMs = new Date(goal.created_at).getTime();
    const since = (matches ?? []).filter(m => m.start_time * 1000 >= goalStartMs);
    const net = since.reduce((acc, m) => acc + (m.win ? 1 : -1), 0);
    return {
      trackedMmr: goal.start_mmr + net * goal.mmr_per_win,
      matchesSinceLockIn: since.length
    };
  }, [goal, matches, player]);

  const projection = useMemo(() => {
    if (!goal) return null;
    return project(goal, trackedMmr, matches ?? []);
  }, [goal, trackedMmr, matches]);

  async function signOutOrSwitch() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  async function refreshNow() {
    setRefreshing(true);
    try {
      await Promise.all([refetchPlayer(), refetchMatches(), refetchGoal()]);
      setRefreshedAt(Date.now());
    } finally {
      setRefreshing(false);
    }
  }

  const subtitle = isGuest
    ? `Viewing the dashboard for account ${accountId} (read-only).`
    : goal
      ? "Your locked goal — recalculates every day."
      : "Confirm your MMR, set a goal, lock in.";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dota 2 MMR Tracker</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {isGuest && (
            <span className="rounded-full border border-border bg-panel2 px-2 py-1 text-[11px] text-muted">
              👁 Viewing as guest
            </span>
          )}
          <button
            className="btn-ghost text-xs"
            onClick={refreshNow}
            disabled={refreshing}
            title="Force-fetch latest from OpenDota"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button className="btn-ghost text-xs" onClick={signOutOrSwitch}>
            {isGuest ? "Sign in" : "Sign out"}
          </button>
        </div>
      </header>

      {playerErr && (
        <div className="card border-lose/40 text-sm text-lose">
          Could not load player {accountId}. Profile may be private.
        </div>
      )}

      {playerLoading && !player && (
        <div className="card text-sm text-muted">Loading player…</div>
      )}

      {/* Main user, no goal yet — show onboarding */}
      {player && !goal && !isGuest && (
        <Onboarding
          player={player}
          accountId={accountId}
          onLocked={() => { refetchGoal(); refetchMatches(); }}
        />
      )}

      {/* Guest, no goal yet — show profile + matches with a notice */}
      {player && !goal && isGuest && (
        <section className="flex flex-col gap-6">
          <div className="card flex items-center gap-4">
            {player.profile.avatarfull && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.profile.avatarfull}
                alt=""
                className="h-14 w-14 rounded-full border border-border"
              />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {player.profile.personaname ?? "Unknown"}
              </div>
              <div className="text-xs text-muted">
                ID {player.profile.account_id} · {player.rank_label}
              </div>
              <div className="text-xs text-muted">
                {player.wins.toLocaleString()}W / {player.losses.toLocaleString()}L · {(player.win_rate * 100).toFixed(1)}% win rate
              </div>
            </div>
          </div>

          <div className="card text-sm text-muted">
            This user hasn&apos;t locked in a goal yet. The progress dashboard appears once they do.
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ProgressChart matches={matches ?? []} />
            <MatchList matches={matches ?? []} />
          </div>
        </section>
      )}

      {/* Goal exists — render the locked dashboard. Reset is hidden for guests. */}
      {player && goal && projection && (
        <LockedDashboard
          player={player}
          matches={matches ?? []}
          projection={projection}
          matchesSinceLockIn={matchesSinceLockIn}
          refreshedAt={refreshedAt}
          readOnly={isGuest}
          onReset={() => { refetchGoal(); }}
        />
      )}
    </main>
  );
}
