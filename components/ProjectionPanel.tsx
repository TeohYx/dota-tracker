import type { GoalProjection } from "@/lib/types";

export default function ProjectionPanel({ projection }: { projection: GoalProjection | null }) {
  if (!projection) {
    return (
      <div className="card flex items-center justify-center text-sm text-muted">
        Set a goal to see your required pace.
      </div>
    );
  }

  const {
    current_mmr, mmr_remaining, wins_remaining,
    days_remaining, net_wins_per_day, on_track,
    net_wins_so_far, expected_net_wins_so_far, goal
  } = projection;

  const reached = current_mmr >= goal.target_mmr;

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Projection</h2>
        {reached ? (
          <span className="rounded-full bg-win/20 px-2 py-0.5 text-xs text-win">Goal reached</span>
        ) : on_track ? (
          <span className="rounded-full bg-win/20 px-2 py-0.5 text-xs text-win">On track</span>
        ) : (
          <span className="rounded-full bg-lose/20 px-2 py-0.5 text-xs text-lose">Behind pace</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Current MMR" value={current_mmr.toLocaleString()} />
        <Stat label="Target MMR" value={goal.target_mmr.toLocaleString()} />
        <Stat label="MMR remaining" value={mmr_remaining.toLocaleString()} />
        <Stat label="Days remaining" value={days_remaining.toString()} />
        <Stat label="Net wins remaining" value={wins_remaining.toString()} />
        <Stat
          label="Net wins per day needed"
          value={reached ? "0" : net_wins_per_day.toFixed(2)}
          accent
        />
      </div>

      <div className="mt-4 rounded-md border border-border bg-panel2 p-3 text-xs text-muted">
        Since this goal was set:{" "}
        <span className={net_wins_so_far >= expected_net_wins_so_far ? "text-win" : "text-lose"}>
          {net_wins_so_far >= 0 ? "+" : ""}{net_wins_so_far} net wins
        </span>{" "}
        vs. expected {expected_net_wins_so_far.toFixed(1)}.
      </div>

      <p className="mt-3 text-xs text-muted">
        &quot;Net wins&quot; = wins minus losses. Each net win moves you ~{goal.mmr_per_win} MMR.
        Pace assumes a steady win-rate to deadline {goal.deadline}.
      </p>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={accent ? "text-2xl font-bold text-accent" : "stat-value"}>{value}</div>
    </div>
  );
}
