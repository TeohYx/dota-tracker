"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { Goal, Match, PlayerSummary } from "@/lib/types";
import { project } from "@/lib/calc";
import Onboarding from "./Onboarding";
import LockedDashboard from "./LockedDashboard";

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
});

export default function Dashboard({ accountId }: { accountId: number }) {
  const { data: player, error: playerErr, isLoading: playerLoading } =
    useSWR<PlayerSummary>(`/api/player/${accountId}`, fetcher, { refreshInterval: 60_000 });

  const { data: matches, mutate: refetchMatches } =
    useSWR<Match[]>(`/api/player/${accountId}/matches?limit=50`, fetcher, { refreshInterval: 60_000 });

  const { data: goal, mutate: refetchGoal } =
    useSWR<Goal | null>(`/api/goal?account_id=${accountId}`, fetcher, { refreshInterval: 60_000 });

  // Tracked MMR derives from the locked starting point + net wins since lock-in.
  const trackedMmr = useMemo(() => {
    if (!goal) return player?.derived_mmr ?? 0;
    const goalStartMs = new Date(goal.created_at).getTime();
    const netSince = (matches ?? [])
      .filter(m => m.start_time * 1000 >= goalStartMs)
      .reduce((acc, m) => acc + (m.win ? 1 : -1), 0);
    return goal.start_mmr + netSince * goal.mmr_per_win;
  }, [goal, matches, player]);

  const projection = useMemo(() => {
    if (!goal) return null;
    return project(goal, trackedMmr, matches ?? []);
  }, [goal, trackedMmr, matches]);

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dota 2 MMR Tracker</h1>
          <p className="text-sm text-muted">
            {goal ? "Your locked goal — recalculates every day." : "Confirm your MMR, set a goal, lock in."}
          </p>
        </div>
        <button className="btn-ghost text-xs" onClick={logout}>Sign out</button>
      </header>

      {playerErr && (
        <div className="card border-lose/40 text-sm text-lose">
          Could not load player {accountId}. Profile may be private.
        </div>
      )}

      {playerLoading && !player && (
        <div className="card text-sm text-muted">Loading player…</div>
      )}

      {player && !goal && (
        <Onboarding
          player={player}
          accountId={accountId}
          onLocked={() => { refetchGoal(); refetchMatches(); }}
        />
      )}

      {player && goal && projection && (
        <LockedDashboard
          player={player}
          matches={matches ?? []}
          projection={projection}
          onReset={() => { refetchGoal(); }}
        />
      )}
    </main>
  );
}
