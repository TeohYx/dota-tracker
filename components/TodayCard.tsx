"use client";

import type { GoalProjection } from "@/lib/types";

export default function TodayCard({ p }: { p: GoalProjection }) {
  const target = p.today_target_wins;
  const net = p.today_net;
  const pct = target > 0 ? Math.min(100, Math.max(0, (net / target) * 100)) : 0;
  const fillColor = p.today_complete ? "#22c55e" : "#ff5722";

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Today</h3>
        {p.today_complete ? (
          <span className="rounded-full bg-win/20 px-2 py-0.5 text-[11px] font-medium text-win">
            Daily target hit
          </span>
        ) : (
          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-medium text-accent">
            Need {Math.max(0, target - net)} more net win{target - net === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-4xl font-bold tabular-nums">
            <span className={net >= 0 ? "text-win" : "text-lose"}>
              {net >= 0 ? "+" : ""}{net}
            </span>
            <span className="text-muted"> / {target}</span>
          </div>
          <div className="text-xs text-muted">net wins today vs target</div>
        </div>
        <div className="text-right text-xs text-muted">
          {p.today_wins}W · {p.today_losses}L
        </div>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-panel2">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: fillColor }}
        />
      </div>

      <p className="text-[11px] text-muted">
        {p.today_complete
          ? "You can call it. Or stack the gain."
          : "Don't let today break the chain."}
      </p>
    </div>
  );
}
