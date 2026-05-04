import type { Match } from "@/lib/types";

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function timeAgo(unix: number) {
  const diff = Date.now() / 1000 - unix;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function MatchList({ matches }: { matches: Match[] }) {
  if (!matches.length) {
    return <div className="card text-sm text-muted">No recent matches.</div>;
  }
  return (
    <div className="card">
      <h2 className="mb-3 text-lg font-semibold">Recent matches</h2>
      <ul className="divide-y divide-border">
        {matches.slice(0, 12).map((m) => (
          <li key={m.match_id} className="flex items-center justify-between py-2 text-sm">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-6 w-10 items-center justify-center rounded text-xs font-semibold ${
                  m.win ? "bg-win/20 text-win" : "bg-lose/20 text-lose"
                }`}
              >
                {m.win ? "WIN" : "LOSS"}
              </span>
              <a
                className="text-text hover:underline"
                href={`https://www.opendota.com/matches/${m.match_id}`}
                target="_blank"
                rel="noreferrer"
              >
                {m.match_id}
              </a>
              <span className="text-muted">{m.kills}/{m.deaths}/{m.assists}</span>
            </div>
            <div className="text-right text-xs text-muted">
              {fmtDuration(m.duration)} · {timeAgo(m.start_time)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
