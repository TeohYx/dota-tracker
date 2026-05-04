"use client";

import { useMemo } from "react";
import type { Match } from "@/lib/types";
import { bucketByDay } from "@/lib/calc";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

export default function ProgressChart({ matches }: { matches: Match[] }) {
  const data = useMemo(() => {
    const buckets = bucketByDay(matches);
    let cumulative = 0;
    return buckets.map(b => {
      cumulative += b.net;
      return {
        date: b.date.slice(5),
        net: b.net,
        cumulative
      };
    });
  }, [matches]);

  if (!data.length) {
    return <div className="card text-sm text-muted">Play some matches to see a trend.</div>;
  }

  return (
    <div className="card">
      <h2 className="mb-3 text-lg font-semibold">Net wins (recent matches)</h2>
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
            <XAxis dataKey="date" tick={{ fill: "#8a93a6", fontSize: 11 }} />
            <YAxis tick={{ fill: "#8a93a6", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#13171f", border: "1px solid #252b3a", borderRadius: 8 }}
              labelStyle={{ color: "#e6e9ef" }}
            />
            <Area type="monotone" dataKey="cumulative" stroke="#ff5722" fill="url(#grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted">Cumulative wins minus losses across the visible window.</p>
    </div>
  );
}
