"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { Goal, Match, PlayerSummary } from "@/lib/types";
import { project } from "@/lib/calc";
import StatsCards from "./StatsCards";
import GoalForm from "./GoalForm";
import MatchList from "./MatchList";
import ProgressChart from "./ProgressChart";
import ProjectionPanel from "./ProjectionPanel";

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
});

export default function Dashboard({ initialAccountId }: { initialAccountId: number }) {
  const [accountId, setAccountId] = useState<number>(initialAccountId);
  const [draftId, setDraftId] = useState<string>(String(initialAccountId));

  const { data: player, error: playerErr, isLoading: playerLoading, mutate: refetchPlayer } =
    useSWR<PlayerSummary>(`/api/player/${accountId}`, fetcher, { refreshInterval: 60_000 });

  const { data: matches, mutate: refetchMatches } =
    useSWR<Match[]>(`/api/player/${accountId}/matches?limit=50`, fetcher, { refreshInterval: 60_000 });

  const { data: goal, mutate: refetchGoal } =
    useSWR<Goal | null>(`/api/goal?account_id=${accountId}`, fetcher);

  const projection = useMemo(() => {
    if (!goal || !player) return null;
    return project(goal, player.derived_mmr, matches ?? []);
  }, [goal, player, matches]);

  const refreshAll = () => { refetchPlayer(); refetchMatches(); refetchGoal(); };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dota 2 MMR Tracker</h1>
          <p className="text-sm text-muted">Set a goal. See the wins-per-day pace you need.</p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(draftId);
            if (Number.isFinite(n) && n > 0) setAccountId(n);
          }}
        >
          <label className="label">Account ID</label>
          <input
            className="input w-40"
            value={draftId}
            onChange={(e) => setDraftId(e.target.value.replace(/\D/g, ""))}
          />
          <button className="btn-ghost" type="submit">Track</button>
          <button className="btn-ghost" type="button" onClick={refreshAll}>Refresh</button>
        </form>
      </header>

      {playerErr && (
        <div className="card mb-6 border-lose/40 text-sm text-lose">
          Could not load player {accountId}. Check the ID, or the player&apos;s OpenDota profile may be private.
        </div>
      )}

      {playerLoading && !player && (
        <div className="card mb-6 text-sm text-muted">Loading player…</div>
      )}

      {player && (
        <>
          <StatsCards player={player} />

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <GoalForm
              accountId={accountId}
              currentMmr={player.derived_mmr}
              existing={goal ?? null}
              onSaved={() => refetchGoal()}
              onCleared={() => refetchGoal()}
            />
            <ProjectionPanel projection={projection} />
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <ProgressChart matches={matches ?? []} />
            <MatchList matches={matches ?? []} />
          </section>

          <footer className="mt-8 text-center text-xs text-muted">
            Data via <a className="underline" href="https://www.opendota.com" target="_blank" rel="noreferrer">OpenDota</a>.
            MMR shown is OpenDota&apos;s computed estimate when available, otherwise a midpoint derived from rank tier.
            Refreshes every 60s.
          </footer>
        </>
      )}
    </main>
  );
}
