"use client";

import { useEffect, useState } from "react";
import type { PlayerSummary } from "@/lib/types";

const MMR_PER_WIN = 25;

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(iso: string): number {
  const a = new Date().setHours(0, 0, 0, 0);
  const b = new Date(`${iso}T23:59:59Z`).getTime();
  return Math.max(0, Math.ceil((b - a) / 86400000));
}

export default function Onboarding({
  player,
  accountId,
  onLocked
}: {
  player: PlayerSummary;
  accountId: number;
  onLocked: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [currentMmr, setCurrentMmr] = useState<string>(String(player.derived_mmr || 3000));
  const [targetMmr, setTargetMmr] = useState<string>(String((player.derived_mmr || 3000) + 500));
  const [days, setDays] = useState<string>("90");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (step === 1 && player.derived_mmr) setCurrentMmr(String(player.derived_mmr));
  }, [player.derived_mmr, step]);

  // Live preview math (step 2)
  const startN = Number(currentMmr) || 0;
  const targetN = Number(targetMmr) || 0;
  const daysN = Math.max(1, Number(days) || 1);
  const mmrGap = Math.max(0, targetN - startN);
  const winsNeeded = Math.ceil(mmrGap / MMR_PER_WIN);
  const mmrPerDay = +(mmrGap / daysN).toFixed(2);
  const winsPerDay = +(winsNeeded / daysN).toFixed(2);
  const deadline = todayPlus(daysN);
  const targetValid = targetN > startN;

  async function lockIn() {
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch("/api/goal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          start_mmr: startN,
          target_mmr: targetN,
          deadline,
          mmr_per_win: MMR_PER_WIN
        })
      });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(typeof j?.error === "string" ? j.error : `HTTP ${res.status}`);
      onLocked();
    } catch (e: any) {
      setErr(e.message ?? "Could not save goal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-center gap-2 text-xs text-muted">
        <Step n={1} active={step >= 1} done={step > 1} label="Confirm MMR" />
        <div className="h-px w-10 bg-border" />
        <Step n={2} active={step >= 2} done={false} label="Set goal" />
      </div>

      {step === 1 && (
        <section className="card flex flex-col gap-5">
          <header>
            <h2 className="text-xl font-bold">Step 1 — Confirm your current MMR</h2>
            <p className="mt-1 text-sm text-muted">
              OpenDota gives an estimate, but Valve hides exact MMR. Enter what you actually see in-game.
            </p>
          </header>

          <div className="flex items-center gap-4 rounded-lg border border-border bg-panel2 p-4">
            {player.profile.avatarfull && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.profile.avatarfull} alt="" className="h-16 w-16 rounded-full border border-border" />
            )}
            <div className="min-w-0">
              <div className="truncate font-semibold">{player.profile.personaname ?? "Unknown"}</div>
              <div className="text-xs text-muted">ID {player.profile.account_id} · {player.rank_label}</div>
              <div className="text-xs text-muted">OpenDota estimate: {player.derived_mmr.toLocaleString()}</div>
            </div>
          </div>

          <label className="block">
            <span className="label">Your current MMR</span>
            <input
              className="input mt-1 text-lg"
              type="number"
              min={0}
              max={15000}
              value={currentMmr}
              onChange={(e) => setCurrentMmr(e.target.value)}
              autoFocus
              required
            />
            <span className="mt-1 block text-xs text-muted">Open Dota 2 → profile → MMR.</span>
          </label>

          <button
            className="btn"
            type="button"
            disabled={!startN || startN <= 0}
            onClick={() => setStep(2)}
          >
            That&apos;s correct, continue →
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="card flex flex-col gap-5">
          <header className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">Step 2 — Set your goal</h2>
              <p className="mt-1 text-sm text-muted">
                Once locked, this can&apos;t be edited — only reset to start over.
              </p>
            </div>
            <button type="button" className="btn-ghost text-xs" onClick={() => setStep(1)}>
              ← Back
            </button>
          </header>

          <div className="grid grid-cols-2 gap-3">
            <Readout label="Starting from" value={startN.toLocaleString()} />
            <label className="block">
              <span className="label">Target MMR</span>
              <input
                className="input mt-1 text-lg"
                type="number"
                min={startN + 1}
                max={15000}
                value={targetMmr}
                onChange={(e) => setTargetMmr(e.target.value)}
                required
              />
            </label>
            <label className="block col-span-2">
              <span className="label">In how many days?</span>
              <input
                className="input mt-1 text-lg"
                type="number"
                min={1}
                max={730}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                required
              />
              <span className="mt-1 block text-xs text-muted">Deadline: {deadline}</span>
            </label>
          </div>

          <div className="rounded-lg border border-border bg-panel2 p-4">
            <div className="label mb-2">What this means</div>
            {targetValid ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <Pill label="MMR to gain" value={mmrGap.toLocaleString()} />
                <Pill label="Net wins" value={winsNeeded.toLocaleString()} />
                <Pill label="Per day" value={`${mmrPerDay} MMR`} sub={`${winsPerDay} wins`} accent />
              </div>
            ) : (
              <div className="text-sm text-lose">Target MMR must be higher than your current MMR.</div>
            )}
          </div>

          {err && (
            <div className="rounded-md border border-lose/40 bg-lose/10 px-3 py-2 text-xs text-lose">
              {err}
            </div>
          )}

          <button
            className="btn text-base"
            type="button"
            onClick={lockIn}
            disabled={submitting || !targetValid}
          >
            {submitting ? "Locking in…" : "Lock in goal"}
          </button>
          <p className="text-center text-[11px] text-muted">No turning back. Time to grind.</p>
        </section>
      )}
    </div>
  );
}

function Step({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${
          done ? "bg-win text-white" : active ? "bg-accent text-white" : "bg-panel2 text-muted"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span className={active ? "text-text" : ""}>{label}</span>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-panel2 px-3 py-2">
      <div className="label">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Pill({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={accent ? "text-2xl font-bold text-accent" : "text-xl font-semibold"}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
