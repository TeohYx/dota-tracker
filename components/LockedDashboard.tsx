"use client";

import { useEffect, useState } from "react";
import type { GoalProjection, Match, PlayerSummary } from "@/lib/types";
import MmrProgress from "./MmrProgress";
import TodayCard from "./TodayCard";
import PaceCard from "./PaceCard";
import CountdownCard from "./CountdownCard";
import MatchList from "./MatchList";
import ProgressChart from "./ProgressChart";

function fmtAgo(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function LockedDashboard({
  player,
  matches,
  projection,
  matchesSinceLockIn,
  refreshedAt,
  readOnly = false,
  onReset
}: {
  player: PlayerSummary;
  matches: Match[];
  projection: GoalProjection;
  matchesSinceLockIn: number;
  refreshedAt: number;
  readOnly?: boolean;
  onReset: () => void;
}) {
  // Re-render every 15s so the "X ago" text stays fresh even between SWR fetches.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);
  const [confirm, setConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function doReset() {
    setResetting(true);
    try {
      await fetch(`/api/goal?account_id=${projection.goal.account_id}`, { method: "DELETE" });
      onReset();
    } finally {
      setResetting(false);
      setConfirm(false);
    }
  }

  const headlineColor = projection.reached
    ? "text-yellow-400"
    : projection.on_track
      ? "text-win"
      : "text-lose";

  return (
    <>
      <section className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {player.profile.avatarfull && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.profile.avatarfull} alt="" className="h-10 w-10 rounded-full border border-border" />
          )}
          <div>
            <div className="font-semibold">{player.profile.personaname ?? "Unknown"}</div>
            <div className="text-xs text-muted">
              ID {player.profile.account_id} · {player.rank_label}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-border bg-panel2 px-2 py-1 text-muted">
            🔒 Goal locked
          </span>
          {!readOnly && (
            <button className="btn-ghost" onClick={() => setConfirm(true)}>Reset goal</button>
          )}
        </div>
      </section>

      <section className="mb-6 text-center">
        <div className={`text-xl font-semibold ${headlineColor}`}>
          {projection.reached
            ? "Goal reached. GG."
            : projection.on_track
              ? "You're on pace. Lock in."
              : "Behind pace. Time to grind."}
        </div>
        <div className="mt-1 text-sm text-muted">
          {projection.progress_pct}% of the way from {projection.goal.start_mmr.toLocaleString()} to {projection.goal.target_mmr.toLocaleString()}
        </div>
        <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-muted">
          <span>
            Since lock-in:{" "}
            <span className="text-text">{matchesSinceLockIn}</span> match{matchesSinceLockIn === 1 ? "" : "es"} ·{" "}
            <span className={projection.net_wins_so_far >= 0 ? "text-win" : "text-lose"}>
              {projection.net_wins_so_far >= 0 ? "+" : ""}{projection.net_wins_so_far} net
            </span>
          </span>
          <span>·</span>
          <span>Updated {fmtAgo(refreshedAt)}</span>
        </div>
        {matchesSinceLockIn === 0 && (
          <div className="mx-auto mt-2 max-w-md text-[11px] text-muted">
            New matches can take a few minutes to appear — OpenDota indexes them after the game ends.
          </div>
        )}
      </section>

      <MmrProgress
        start={projection.goal.start_mmr}
        current={projection.current_mmr}
        target={projection.goal.target_mmr}
        progressPct={projection.progress_pct}
        reached={projection.reached}
        onTrack={projection.on_track}
      />

      <section className="mt-6 grid gap-6 md:grid-cols-3">
        <CountdownCard p={projection} />
        <PaceCard p={projection} />
        <TodayCard p={projection} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <ProgressChart matches={matches} />
        <MatchList matches={matches} />
      </section>

      <footer className="mt-8 text-center text-xs text-muted">
        Data via OpenDota. Pace recomputes daily — your wins/day target shifts as days tick down.
      </footer>

      {confirm && !readOnly && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="card w-full max-w-md">
            <h3 className="text-lg font-semibold">Reset your goal?</h3>
            <p className="mt-2 text-sm text-muted">
              This wipes your current goal and sends you back to the start. Your match history isn&apos;t affected.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setConfirm(false)} disabled={resetting}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: "#ef4444" }}
                onClick={doReset}
                disabled={resetting}
              >
                {resetting ? "Resetting…" : "Yes, reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
