"use client";

import { useMemo, useState } from "react";
import type { Match } from "@/lib/types";
import { bucketByDay } from "@/lib/calc";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

const MS_PER_DAY = 86_400_000;
const WINDOWS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 }
] as const;

export default function ProgressChart({ matches }: { matches: Match[] }) {
  const [days, setDays] = useState<number>(30);

  const { data, totalNet, totalMatches } = useMemo(() => {
    const cutoff = Date.now() - days * MS_PER_DAY;
    const windowed = matches.filter(m => m.start_time * 1000 >= cutoff);
    const buckets = bucketByDay(windowed);
    let cumulative = 0;
    const data = buckets.map(b => {
      cumulative += b.net;
      return {
        date: b.date.slice(5),
        net: b.net,
        cumulative
      };
    });
    const totalNet = windowed.reduce((acc, m) => acc + (m.win ? 1 : -1), 0);
    return { data, totalNet, totalMatches: windowed.length };
  }, [matches, days]);

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Net wins</h2>
          <p className="text-[11px] text-muted">
            {totalMatches} match{totalMatches === 1 ? "" : "es"} ·{" "}
            <span className={totalNet >= 0 ? "text-win" : "text-lose"}>
              {totalNet >= 0 ? "+" : ""}{totalNet} net
            </span>
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-panel2 p-0.5">
          {WINDOWS.map(w => (
            <button
              key={w.days}
              type="button"
              onClick={() => setDays(w.days)}
              className={`rounded px-2 py-1 text-xs transition ${
                days === w.days
                  ? "bg-accent text-white"
                  : "text-muted hover:text-text"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted">
          No matches in the last {days} days.
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff5722" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ff5722" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#252b3a" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "#8a93a6", fontSize: 11 }} minTickGap={20} />
              <YAxis tick={{ fill: "#8a93a6", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#13171f", border: "1px solid #252b3a", borderRadius: 8 }}
                labelStyle={{ color: "#e6e9ef" }}
              />
              <Area type="monotone" dataKey="cumulative" stroke="#ff5722" fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        Cumulative wins minus losses across the visible window.
      </p>
    </div>
  );
}
