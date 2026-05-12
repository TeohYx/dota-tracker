import { NextResponse } from "next/server";
import {
  getGoal,
  getUsersWithNotifications,
  setLastMatchId
} from "@/lib/db";
import { fetchMatches } from "@/lib/opendota";
import { computeMatchUpdates, notifyMatch } from "@/lib/notify";

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

  const users = await getUsersWithNotifications();
  const results: Array<{ user_id: number; sent: number; error?: string }> = [];

  for (const user of users) {
    if (!user.account_id || !user.telegram_chat_id) continue;
    try {
      // Match the frontend window (90d/500). Cursor base counts all
      // post-lockin ranked matches, so a narrow window silently undercounts
      // historical losses and inflates mmrAfter on the next notification.
      const matches = await fetchMatches(user.account_id, { days: 90, limit: 500 });
      if (matches.length === 0) {
        results.push({ user_id: user.id, sent: 0 });
        continue;
      }
      const maxSeen = matches.reduce((m, x) => Math.max(m, x.match_id), 0);

      // First poll after enabling: don't replay history. Record watermark.
      if (user.last_match_id == null) {
        await setLastMatchId(user.id, maxSeen);
        results.push({ user_id: user.id, sent: 0 });
        continue;
      }

      const goal = await getGoal(user.id);
      const mmrPerWin = goal?.mmr_per_win ?? 25;
      const updates = computeMatchUpdates({
        matches,
        lastMatchId: user.last_match_id,
        goal
      });

      for (const { match, mmrAfter } of updates) {
        await notifyMatch(user, match, { mmrAfter, mmrPerWin });
      }

      // Advance the watermark across ALL matches (including non-ranked) so
      // turbos/normal queue games aren't reconsidered on the next poll.
      await setLastMatchId(user.id, Math.max(maxSeen, user.last_match_id));
      results.push({ user_id: user.id, sent: updates.length });
    } catch (err: any) {
      results.push({ user_id: user.id, sent: 0, error: err?.message ?? String(err) });
    }
  }

  return NextResponse.json({ ok: true, results });
}
