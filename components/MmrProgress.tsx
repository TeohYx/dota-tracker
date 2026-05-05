"use client";

import { useEffect, useState } from "react";

export default function MmrProgress({
  start,
  current,
  target,
  progressPct,
  reached,
  onTrack
}: {
  start: number;
  current: number;
  target: number;
  progressPct: number;
  reached: boolean;
  onTrack: boolean;
}) {
  // Animate the ring on mount
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPct(progressPct), 80);
    return () => clearTimeout(t);
  }, [progressPct]);

  const size = 220;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  const ringColor = reached ? "#facc15" : onTrack ? "#22c55e" : "#ef4444";

  return (
    <div className="card flex flex-col items-center gap-4 sm:flex-row sm:items-stretch">
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#252b3a" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={ringColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted">Current MMR</div>
            <div className="text-4xl font-bold tabular-nums">{current.toLocaleString()}</div>
            <div className="mt-1 text-xs text-muted">{progressPct}% to goal</div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        <div className="text-sm text-muted">
          {reached ? (
            <span className="text-yellow-400">Goal reached. Take a victory lap.</span>
          ) : onTrack ? (
            <span className="text-win">Locked in. Keep the pace.</span>
          ) : (
            <span className="text-lose">Behind pace. Lock back in.</span>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>{start.toLocaleString()}</span>
            <span>{target.toLocaleString()}</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-panel2">
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-out"
              style={{
                width: `${Math.min(100, Math.max(0, pct))}%`,
                background: ringColor
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <Mini label="Start" value={start.toLocaleString()} />
          <Mini label="Now" value={current.toLocaleString()} accent />
          <Mini label="Target" value={target.toLocaleString()} />
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-panel2 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={accent ? "text-base font-bold text-accent" : "text-base font-semibold"}>
        {value}
      </div>
    </div>
  );
}
