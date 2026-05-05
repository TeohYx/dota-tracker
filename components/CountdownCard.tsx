"use client";

import { useEffect, useState } from "react";
import type { GoalProjection } from "@/lib/types";

function pad(n: number) { return String(n).padStart(2, "0"); }

export default function CountdownCard({ p }: { p: GoalProjection }) {
  const [hms, setHms] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const tick = () => {
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      const diff = Math.max(0, tomorrow.getTime() - Date.now());
      const h = Math.floor(diff / 3.6e6);
      const m = Math.floor((diff % 3.6e6) / 6e4);
      const s = Math.floor((diff % 6e4) / 1000);
      setHms({ h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Countdown
      </h3>
      <div>
        <div className="text-6xl font-bold tabular-nums leading-none">
          {p.days_remaining}
        </div>
        <div className="mt-1 text-xs text-muted">
          day{p.days_remaining === 1 ? "" : "s"} until {p.goal.deadline}
        </div>
      </div>

      <div className="rounded-md border border-border bg-panel2 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-muted">Today resets in</div>
        <div className="font-mono text-lg tabular-nums">
          {pad(hms.h)}:{pad(hms.m)}:{pad(hms.s)}
        </div>
      </div>
    </div>
  );
}
