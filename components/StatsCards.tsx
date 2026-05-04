import type { PlayerSummary } from "@/lib/types";

export default function StatsCards({ player }: { player: PlayerSummary }) {
  const wr = (player.win_rate * 100).toFixed(1);
  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className="card flex items-center gap-4">
        {player.profile.avatarfull ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.profile.avatarfull}
            alt=""
            className="h-14 w-14 rounded-full border border-border"
          />
        ) : (
          <div className="h-14 w-14 rounded-full bg-panel2" />
        )}
        <div className="min-w-0">
          <div className="label">Player</div>
          <div className="truncate text-sm font-semibold">{player.profile.personaname ?? "Unknown"}</div>
          <div className="truncate text-xs text-muted">ID {player.profile.account_id}</div>
        </div>
      </div>

      <div className="card">
        <div className="label">Estimated MMR</div>
        <div className="stat-value">{player.derived_mmr.toLocaleString()}</div>
        <div className="text-xs text-muted">{player.rank_label}{player.leaderboard_rank ? ` · #${player.leaderboard_rank}` : ""}</div>
      </div>

      <div className="card">
        <div className="label">Lifetime Record</div>
        <div className="stat-value">{player.wins.toLocaleString()} W / {player.losses.toLocaleString()} L</div>
        <div className="text-xs text-muted">{player.total.toLocaleString()} matches</div>
      </div>

      <div className="card">
        <div className="label">Win Rate</div>
        <div className="stat-value">{wr}%</div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel2">
          <div
            className="h-full bg-win"
            style={{ width: `${Math.min(100, Number(wr))}%` }}
          />
        </div>
      </div>
    </section>
  );
}
