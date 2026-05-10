import { NextResponse } from "next/server";
import {
  getGoal,
  getUsersWithNotifications,
  setLastMatchId
} from "@/lib/db";
import { fetchMatches } from "@/lib/opendota";
import { notifyMatch } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  // Accept Authorization: Bearer <secret> (Vercel Cron's default) OR a custom
  // x-cron-secret header (works for cron-job.org which doesn't always allow
  // setting Authorization).
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${expected}`) return false;
  if (req.headers.get("x-cron-secret") === expected) return false;
  return true;
}

export async function GET(req: Request) {
  if (unauthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const users = await getUsersWithNotifications();
  const results: Array<{ user_id: number; sent: number; error?: string }> = [];

  for (const user of users) {
    if (!user.account_id || !user.telegram_chat_id) continue;
    try {
      // 7-day window is plenty for incremental polling. Limit kept small to
      // be polite to OpenDota; if a user plays >20 ranked games between polls,
      // they'll just get a notification for the most recent ones.
      const matches = await fetchMatches(user.account_id, { days: 7, limit: 20 });
      if (matches.length === 0) {
        results.push({ user_id: user.id, sent: 0 });
        continue;
      }
      const maxSeen = matches.reduce((m, x) => Math.max(m, x.match_id), 0);

      // First poll after enabling: don't replay history. Just record where we
      // are and start notifying on the next new match.
      if (user.last_match_id == null) {
        await setLastMatchId(user.id, maxSeen);
        results.push({ user_id: user.id, sent: 0 });
        continue;
      }

      const fresh = matches
        .filter(m => m.match_id > user.last_match_id!)
        .sort((a, b) => a.start_time - b.start_time);

      if (fresh.length === 0) {
        results.push({ user_id: user.id, sent: 0 });
        continue;
      }

      const goal = await getGoal(user.id);
      const mmrPerWin = goal?.mmr_per_win ?? 25;

      // Walk chronologically so the running MMR after each match makes sense.
      let mmrCursor = goal
        ? goal.start_mmr +
          // Net wins between goal lock-in and the start of this batch
          matches
            .filter(m => m.start_time * 1000 >= new Date(goal.created_at).getTime() && m.match_id <= user.last_match_id!)
            .reduce((acc, m) => acc + (m.win ? 1 : -1), 0) * mmrPerWin
        : undefined;

      for (const m of fresh) {
        if (mmrCursor != null) {
          mmrCursor += (m.win ? 1 : -1) * mmrPerWin;
        }
        await notifyMatch(user, m, { mmrAfter: mmrCursor, mmrPerWin });
      }

      await setLastMatchId(user.id, Math.max(maxSeen, user.last_match_id));
      results.push({ user_id: user.id, sent: fresh.length });
    } catch (err: any) {
      results.push({ user_id: user.id, sent: 0, error: err?.message ?? String(err) });
    }
  }

  return NextResponse.json({ ok: true, results });
}
