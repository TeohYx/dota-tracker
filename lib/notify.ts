import type { Goal, Match, User } from "./types";
import { sendMessage } from "./telegram";
import { getHeroName } from "./opendota";

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000; // Asia/Kuala_Lumpur (UTC+8)

// Dota's "Ranked Matchmaking" lobby type. Only matches with this lobby_type
// affect ranked MMR — turbos/normal queue/bots/parties must be excluded from
// MMR cursor math, otherwise non-ranked games inflate the tracked MMR.
export const RANKED_LOBBY_TYPE = 7;

export function isRankedMatch(m: Match): boolean {
  return m.lobby_type === RANKED_LOBBY_TYPE;
}

export type MatchUpdate = { match: Match; mmrAfter: number | undefined };

// Pure function: given OpenDota matches, the last-seen match id, and the goal,
// return the fresh ranked matches to notify and the running MMR cursor for each.
// Non-ranked matches are filtered out for both the historical base count and
// the fresh list, so they neither produce notifications nor move MMR.
export function computeMatchUpdates(input: {
  matches: Match[];
  lastMatchId: number;
  goal: Goal | null;
}): MatchUpdate[] {
  const ranked = input.matches.filter(isRankedMatch);
  const fresh = ranked
    .filter(m => m.match_id > input.lastMatchId)
    .sort((a, b) => a.start_time - b.start_time);
  if (fresh.length === 0) return [];

  const mmrPerWin = input.goal?.mmr_per_win ?? 25;
  let cursor: number | undefined = input.goal
    ? input.goal.start_mmr +
      ranked
        .filter(
          m =>
            m.start_time * 1000 >= new Date(input.goal!.created_at).getTime() &&
            m.match_id <= input.lastMatchId
        )
        .reduce((acc, m) => acc + (m.win ? 1 : -1), 0) * mmrPerWin
    : undefined;

  const updates: MatchUpdate[] = [];
  for (const match of fresh) {
    if (cursor != null) cursor += (match.win ? 1 : -1) * mmrPerWin;
    updates.push({ match, mmrAfter: cursor });
  }
  return updates;
}

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
  opts: { mmrAfter?: number; mmrPerWin: number; heroName?: string }
): string {
  const verdict = match.win ? "✅ <b>Win</b>" : "❌ <b>Loss</b>";
  const delta = match.win ? `+${opts.mmrPerWin}` : `-${opts.mmrPerWin}`;
  const mmrLine = opts.mmrAfter != null
    ? `\nMMR: <b>${opts.mmrAfter.toLocaleString()}</b> (${delta})`
    : `\n${delta} MMR`;
  const hero = opts.heroName ?? `Hero ${match.hero_id}`;
  return [
    `${verdict} — match <code>${match.match_id}</code>`,
    `${hero} · KDA ${fmtKDA(match)} · ${fmtDuration(match.duration)}`
  ].join("\n") + mmrLine;
}

export type DailySummary = {
  date: string;
  wins: number;
  losses: number;
  net: number;
  mmrDelta: number;
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
  const heroName = await getHeroName(match.hero_id);
  await sendMessage(user.telegram_chat_id, composeMatchMessage(match, { ...opts, heroName }));
}

export async function notifyDaily(user: User, summary: DailySummary): Promise<void> {
  if (!user.telegram_chat_id) return;
  await sendMessage(user.telegram_chat_id, composeDailyMessage(summary));
}

// Returns [startMs, endMs) for "previous day" in MY tz, given the current time.
// At 00:00 MY this gives yesterday 00:00 .. today 00:00 MY.
export function previousMyDayRange(nowMs: number = Date.now()): {
  startMs: number;
  endMs: number;
  dateLabel: string;
} {
  const myNow = new Date(nowMs + TZ_OFFSET_MS);
  const myDateToday = myNow.toISOString().slice(0, 10);
  const startToday = Date.parse(`${myDateToday}T00:00:00+08:00`);
  const startYesterday = startToday - 24 * 60 * 60 * 1000;
  const yesterday = new Date(startYesterday + TZ_OFFSET_MS).toISOString().slice(0, 10);
  return { startMs: startYesterday, endMs: startToday, dateLabel: yesterday };
}
