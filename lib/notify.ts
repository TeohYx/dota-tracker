import type { Goal, Match, User } from "./types";
import { sendMessage } from "./telegram";

const TZ = "Asia/Kuala_Lumpur";
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

// Hero name lookup is overkill — OpenDota's heroes endpoint would let us map
// hero_id -> name, but for the notification we keep it small and just print
// the id. If we ever want names, fetch /heroes once and cache.
function fmtKDA(m: Match): string {
  return `${m.kills}/${m.deaths}/${m.assists}`;
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function composeMatchMessage(
  match: Match,
  opts: { mmrAfter?: number; mmrPerWin: number }
): string {
  const verdict = match.win ? "✅ <b>Win</b>" : "❌ <b>Loss</b>";
  const delta = match.win ? `+${opts.mmrPerWin}` : `-${opts.mmrPerWin}`;
  const mmrLine = opts.mmrAfter != null
    ? `\nMMR: <b>${opts.mmrAfter.toLocaleString()}</b> (${delta})`
    : `\n${delta} MMR`;
  return [
    `${verdict} — match <code>${match.match_id}</code>`,
    `Hero ${match.hero_id} · KDA ${fmtKDA(match)} · ${fmtDuration(match.duration)}`
  ].join("\n") + mmrLine;
}

export type DailySummary = {
  date: string;       // YYYY-MM-DD (the day we're summarizing, in MY tz)
  wins: number;
  losses: number;
  net: number;
  mmrDelta: number;   // computed from net * mmr_per_win
  mmrAfter?: number;
  goal?: Goal;
};

export function composeDailyMessage(s: DailySummary): string {
  const total = s.wins + s.losses;
  const lines: string[] = [];
  lines.push(`📊 <b>Daily summary — ${s.date}</b>`);
  if (total === 0) {
    lines.push("No ranked matches played yesterday. Take the rest day or grind harder?");
    return lines.join("\n");
  }
  const sign = s.net > 0 ? "+" : "";
  lines.push(`<b>${s.wins}W</b> / <b>${s.losses}L</b> · net <b>${sign}${s.net}</b> (${total} games)`);
  lines.push(`MMR change: <b>${sign}${s.mmrDelta}</b>${s.mmrAfter != null ? ` → <b>${s.mmrAfter.toLocaleString()}</b>` : ""}`);
  if (s.goal) {
    const remaining = Math.max(0, s.goal.target_mmr - (s.mmrAfter ?? s.goal.start_mmr));
    if (remaining === 0) {
      lines.push("🏆 Goal reached. GG.");
    } else {
      lines.push(`Target <b>${s.goal.target_mmr.toLocaleString()}</b> · ${remaining.toLocaleString()} MMR to go.`);
    }
  }
  return lines.join("\n");
}

export async function notifyMatch(
  user: User,
  match: Match,
  opts: { mmrAfter?: number; mmrPerWin: number }
): Promise<void> {
  if (!user.telegram_chat_id) return;
  await sendMessage(user.telegram_chat_id, composeMatchMessage(match, opts));
}

export async function notifyDaily(user: User, summary: DailySummary): Promise<void> {
  if (!user.telegram_chat_id) return;
  await sendMessage(user.telegram_chat_id, composeDailyMessage(summary));
}

// Returns [startMs, endMs) for "previous day" in MY tz, given the current time.
// At 00:00 MY this gives yesterday 00:00..today 00:00 MY.
export function previousMyDayRange(nowMs: number = Date.now()): {
  startMs: number;
  endMs: number;
  dateLabel: string;
} {
  const myNow = new Date(nowMs + TZ_OFFSET_MS);
  // myNow is the "MY wall clock" expressed as a UTC Date. Truncate to date.
  const myDateToday = myNow.toISOString().slice(0, 10);
  const startToday = Date.parse(`${myDateToday}T00:00:00+08:00`);
  const startYesterday = startToday - 24 * 60 * 60 * 1000;
  const yesterday = new Date(startYesterday + TZ_OFFSET_MS).toISOString().slice(0, 10);
  return { startMs: startYesterday, endMs: startToday, dateLabel: yesterday };
}

export const NOTIFY_TZ = TZ;
