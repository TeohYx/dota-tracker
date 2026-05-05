import type { GoalProjection } from "@/lib/types";

export default function PaceCard({ p }: { p: GoalProjection }) {
  return (
    <div className="card flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Required pace
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="MMR / day"
          value={p.reached ? "0" : p.mmr_per_day_needed.toFixed(2)}
          accent
        />
        <Stat
          label="Wins / day"
          value={p.reached ? "0" : p.wins_per_day_needed.toFixed(2)}
        />
        <Stat label="MMR remaining" value={p.mmr_remaining.toLocaleString()} />
        <Stat label="Net wins remaining" value={p.wins_remaining.toLocaleString()} />
      </div>

      <div className="rounded-md border border-border bg-panel2 px-3 py-2 text-[11px] text-muted">
        Since lock-in:{" "}
        <span className={p.net_wins_so_far >= p.expected_net_wins_so_far ? "text-win" : "text-lose"}>
          {p.net_wins_so_far >= 0 ? "+" : ""}{p.net_wins_so_far} net
        </span>
        {" "}vs expected {p.expected_net_wins_so_far.toFixed(1)}
      </div>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-panel2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={accent ? "text-2xl font-bold text-accent tabular-nums" : "text-xl font-semibold tabular-nums"}>
        {value}
      </div>
    </div>
  );
}
