"use client";

import { useEffect, useState } from "react";
import type { Goal } from "@/lib/types";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function GoalForm({
  accountId,
  currentMmr,
  existing,
  onSaved,
  onCleared
}: {
  accountId: number;
  currentMmr: number;
  existing: Goal | null;
  onSaved: () => void;
  onCleared: () => void;
}) {
  const [startMmr, setStartMmr] = useState<string>(String(currentMmr || 3000));
  const [targetMmr, setTargetMmr] = useState<string>(String((currentMmr || 3000) + 500));
  const [deadline, setDeadline] = useState<string>(todayPlus(30));
  const [mmrPerWin, setMmrPerWin] = useState<string>("30");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setStartMmr(String(existing.start_mmr));
      setTargetMmr(String(existing.target_mmr));
      setDeadline(existing.deadline);
      setMmrPerWin(String(existing.mmr_per_win));
    } else if (currentMmr) {
      setStartMmr(String(currentMmr));
      setTargetMmr(String(currentMmr + 500));
    }
  }, [existing, currentMmr]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/goal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          start_mmr: Number(startMmr),
          target_mmr: Number(targetMmr),
          deadline,
          mmr_per_win: Number(mmrPerWin)
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Could not save goal");
      }
      onSaved();
    } catch (e: any) {
      setErr(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    setSaving(true);
    try {
      await fetch(`/api/goal?account_id=${accountId}`, { method: "DELETE" });
      onCleared();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card flex flex-col gap-3" onSubmit={save}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Goal</h2>
        {existing && (
          <button type="button" className="btn-ghost text-xs" onClick={clear} disabled={saving}>
            Clear goal
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Starting MMR</span>
          <input
            className="input"
            type="number"
            min={0}
            value={startMmr}
            onChange={(e) => setStartMmr(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="label">Target MMR</span>
          <input
            className="input"
            type="number"
            min={1}
            value={targetMmr}
            onChange={(e) => setTargetMmr(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="label">Deadline</span>
          <input
            className="input"
            type="date"
            min={todayPlus(1)}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="label">MMR per win</span>
          <input
            className="input"
            type="number"
            min={10}
            max={50}
            value={mmrPerWin}
            onChange={(e) => setMmrPerWin(e.target.value)}
            required
          />
        </label>
      </div>

      {err && <div className="text-xs text-lose">{err}</div>}

      <div className="flex items-center gap-2">
        <button className="btn" type="submit" disabled={saving}>
          {existing ? "Update goal" : "Set goal"}
        </button>
        <span className="text-xs text-muted">
          Stored server-side. Default 30 MMR/win matches Valve&apos;s ranked formula.
        </span>
      </div>
    </form>
  );
}
