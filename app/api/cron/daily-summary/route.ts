import { NextResponse } from "next/server";
import { getGoal, getUsersWithNotifications } from "@/lib/db";
import { fetchMatches } from "@/lib/opendota";
import { isRankedMatch, notifyDaily, previousMyDayRange, type DailySummary } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${expected}`) return false;
  if (req.headers.get("x-cron-secret") === expected) return false;
  return true;
}

export async function GET(req: Request) {
  if (unauthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { startMs, endMs, dateLabel } = previousMyDayRange();
  const users = await getUsersWithNotifications();
  const results: Array<{ user_id: number; sent: boolean; error?: string }> = [];

  for (const user of users) {
    if (!user.account_id || !user.telegram_chat_id) continue;
    try {
      const allMatches = await fetchMatches(user.account_id, { days: 2, limit: 100 });
      const matches = allMatches.filter(isRankedMatch);
      const yesterday = matches.filter(
        m => m.start_time * 1000 >= startMs && m.start_time * 1000 < endMs
      );
      const wins = yesterday.filter(m => m.win).length;
      const losses = yesterday.length - wins;
      const net = wins - losses;

      const goal = await getGoal(user.id);
      const mmrPerWin = goal?.mmr_per_win ?? 25;
      const mmrDelta = net * mmrPerWin;

      let mmrAfter: number | undefined;
      if (goal) {
        const sinceLockIn = matches.filter(
          m => m.start_time * 1000 >= new Date(goal.created_at).getTime() && m.start_time * 1000 < endMs
        );
        const netSinceLockIn = sinceLockIn.reduce((a, m) => a + (m.win ? 1 : -1), 0);
        mmrAfter = goal.start_mmr + netSinceLockIn * mmrPerWin;
      }

      const summary: DailySummary = {
        date: dateLabel,
        wins,
        losses,
        net,
        mmrDelta,
        mmrAfter,
        goal: goal ?? undefined
      };
      await notifyDaily(user, summary);
      results.push({ user_id: user.id, sent: true });
    } catch (err: any) {
      results.push({ user_id: user.id, sent: false, error: err?.message ?? String(err) });
    }
  }

  return NextResponse.json({ ok: true, dateLabel, results });
}
