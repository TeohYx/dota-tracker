import { describe, expect, it } from "vitest";
import {
  composeMatchMessage,
  composeDailyMessage,
  computeMatchUpdates,
  previousMyDayRange
} from "@/lib/notify";
import type { Goal, Match } from "@/lib/types";

const baseMatch: Match = {
  match_id: 8123456789,
  hero_id: 1,
  start_time: 1_700_000_000,
  duration: 2_400,
  kills: 10,
  deaths: 3,
  assists: 12,
  win: true,
  game_mode: 22,
  lobby_type: 7
};

function mkMatch(over: Partial<Match> & { match_id: number }): Match {
  // Default start_time is post-lock-in (2026-05-02) and monotonic in match_id,
  // so matches are always inside the goal window unless a test overrides it.
  const postLockIn = Math.floor(Date.parse("2026-05-02T00:00:00Z") / 1000);
  return {
    ...baseMatch,
    start_time: postLockIn + over.match_id,
    ...over
  };
}

const goal: Goal = {
  user_id: 1,
  start_mmr: 7_000,
  target_mmr: 10_000,
  deadline: "2026-12-31",
  created_at: "2026-05-01T00:00:00Z",
  mmr_per_win: 25
};

describe("composeMatchMessage", () => {
  it("uses heroName when provided (regression: showed hero id)", () => {
    const out = composeMatchMessage(baseMatch, {
      mmrPerWin: 25,
      mmrAfter: 4200,
      heroName: "Anti-Mage"
    });
    expect(out).toContain("Anti-Mage");
    expect(out).not.toMatch(/Hero 1\b/);
  });

  it("falls back to `Hero <id>` when name unavailable", () => {
    const out = composeMatchMessage(baseMatch, { mmrPerWin: 25 });
    expect(out).toContain("Hero 1");
  });

  it("renders win verdict with +MMR and current MMR", () => {
    const out = composeMatchMessage(baseMatch, {
      mmrPerWin: 25,
      mmrAfter: 4200,
      heroName: "Pudge"
    });
    expect(out).toContain("Win");
    expect(out).toContain("+25");
    expect(out).toContain("4,200");
  });

  it("renders loss verdict with -MMR", () => {
    const out = composeMatchMessage(
      { ...baseMatch, win: false },
      { mmrPerWin: 25, heroName: "Pudge" }
    );
    expect(out).toContain("Loss");
    expect(out).toContain("-25");
  });

  it("formats KDA and duration", () => {
    const out = composeMatchMessage(baseMatch, { mmrPerWin: 25, heroName: "Pudge" });
    expect(out).toContain("10/3/12");
    expect(out).toContain("40m 00s");
  });
});

describe("composeDailyMessage", () => {
  it("handles a zero-game day", () => {
    const out = composeDailyMessage({
      date: "2026-05-11",
      wins: 0,
      losses: 0,
      net: 0,
      mmrDelta: 0
    });
    expect(out).toContain("2026-05-11");
    expect(out).toContain("No ranked matches");
  });

  it("renders W/L, net, MMR change, and goal remaining", () => {
    const out = composeDailyMessage({
      date: "2026-05-11",
      wins: 3,
      losses: 1,
      net: 2,
      mmrDelta: 50,
      mmrAfter: 4250,
      goal: {
        user_id: 1,
        start_mmr: 4000,
        target_mmr: 5000,
        deadline: "2026-12-31",
        created_at: "2026-01-01T00:00:00Z",
        mmr_per_win: 25
      }
    });
    expect(out).toContain("3W");
    expect(out).toContain("1L");
    expect(out).toContain("+2");
    expect(out).toContain("+50");
    expect(out).toContain("4,250");
    expect(out).toContain("750"); // 5000 - 4250 remaining
  });

  it("announces goal reached", () => {
    const out = composeDailyMessage({
      date: "2026-05-11",
      wins: 1,
      losses: 0,
      net: 1,
      mmrDelta: 25,
      mmrAfter: 5000,
      goal: {
        user_id: 1,
        start_mmr: 4000,
        target_mmr: 5000,
        deadline: "2026-12-31",
        created_at: "2026-01-01T00:00:00Z",
        mmr_per_win: 25
      }
    });
    expect(out).toContain("Goal reached");
  });
});

describe("computeMatchUpdates", () => {
  it("advances cursor by exactly mmrPerWin per ranked match", () => {
    // Regression: telegram notifications showed MMR jumping by +50 per match
    // while the label said +25, because non-ranked games were inflating the
    // cursor between cron runs.
    const matches: Match[] = [
      // Historical ranked match (since lock-in, <= lastMatchId) — counted as +1 win
      mkMatch({ match_id: 100, win: true, lobby_type: 7 }),
      // Three fresh ranked matches: W, L, W
      mkMatch({ match_id: 101, win: true, lobby_type: 7 }),
      mkMatch({ match_id: 102, win: false, lobby_type: 7 }),
      mkMatch({ match_id: 103, win: true, lobby_type: 7 })
    ];
    const updates = computeMatchUpdates({ matches, lastMatchId: 100, goal });
    expect(updates).toHaveLength(3);
    expect(updates[0].mmrAfter).toBe(7_050); // 7_000 + 1*25 (history) + 25
    expect(updates[1].mmrAfter).toBe(7_025); // -25
    expect(updates[2].mmrAfter).toBe(7_050); // +25
  });

  it("ignores non-ranked matches in both fresh list and base cursor", () => {
    // Mix of ranked + turbo (lobby_type 0). Only the ranked one should notify
    // and only the ranked ones should move MMR.
    const matches: Match[] = [
      mkMatch({ match_id: 100, win: true, lobby_type: 7 }), // historical ranked W
      mkMatch({ match_id: 101, win: true, lobby_type: 0 }), // historical turbo W — must not count
      mkMatch({ match_id: 102, win: true, lobby_type: 0 }), // fresh turbo W — must not notify
      mkMatch({ match_id: 103, win: true, lobby_type: 7 })  // fresh ranked W
    ];
    const updates = computeMatchUpdates({ matches, lastMatchId: 101, goal });
    expect(updates).toHaveLength(1);
    expect(updates[0].match.match_id).toBe(103);
    expect(updates[0].mmrAfter).toBe(7_050); // base = 7_000 + 1*25 (only ranked m100), then +25
  });

  it("excludes matches before goal.created_at from the historical base", () => {
    const matches: Match[] = [
      // Pre-lock-in win — must not count toward base
      mkMatch({
        match_id: 50,
        start_time: Math.floor(Date.parse("2026-04-01T00:00:00Z") / 1000),
        win: true,
        lobby_type: 7
      }),
      // Post-lock-in historical loss — counted as -1
      mkMatch({
        match_id: 100,
        start_time: Math.floor(Date.parse("2026-05-02T00:00:00Z") / 1000),
        win: false,
        lobby_type: 7
      }),
      // Fresh ranked win
      mkMatch({
        match_id: 101,
        start_time: Math.floor(Date.parse("2026-05-11T10:00:00Z") / 1000),
        win: true,
        lobby_type: 7
      })
    ];
    const updates = computeMatchUpdates({ matches, lastMatchId: 100, goal });
    expect(updates).toHaveLength(1);
    expect(updates[0].mmrAfter).toBe(7_000); // 7_000 - 25 (history) + 25 (fresh)
  });

  it("returns an empty list when there are no fresh ranked matches", () => {
    const matches: Match[] = [
      mkMatch({ match_id: 100, win: true, lobby_type: 7 }),
      mkMatch({ match_id: 101, win: true, lobby_type: 0 }) // turbo, ignored
    ];
    const updates = computeMatchUpdates({ matches, lastMatchId: 100, goal });
    expect(updates).toEqual([]);
  });

  it("leaves mmrAfter undefined when no goal is set", () => {
    const matches: Match[] = [mkMatch({ match_id: 101, win: true, lobby_type: 7 })];
    const updates = computeMatchUpdates({ matches, lastMatchId: 100, goal: null });
    expect(updates).toHaveLength(1);
    expect(updates[0].mmrAfter).toBeUndefined();
  });

  it("requires full post-lockin window: narrow window inflates mmrAfter", () => {
    // Regression: telegram mmrAfter was 75 MMR higher than the frontend because
    // poll-matches fetched only the last 7 days / 20 matches. Older post-lockin
    // losses fell outside the window, so the base undercounted losses.
    // The function trusts the caller to supply all post-lockin ranked matches.
    // This test documents that contract: when older losses are absent, mmrAfter
    // drifts upward; when present, it matches reality.
    const oldLoss = mkMatch({
      match_id: 80,
      start_time: Math.floor(Date.parse("2026-05-02T00:00:00Z") / 1000),
      win: false,
      lobby_type: 7
    });
    const fresh = mkMatch({
      match_id: 101,
      start_time: Math.floor(Date.parse("2026-05-11T10:00:00Z") / 1000),
      win: true,
      lobby_type: 7
    });

    const narrow = computeMatchUpdates({
      matches: [fresh], // old loss missing — simulates narrow fetch window
      lastMatchId: 80,
      goal
    });
    expect(narrow[0].mmrAfter).toBe(7_025); // 7_000 + 0 (missing) + 25

    const wide = computeMatchUpdates({
      matches: [oldLoss, fresh],
      lastMatchId: 80,
      goal
    });
    expect(wide[0].mmrAfter).toBe(7_000); // 7_000 - 25 (loss) + 25 (fresh)
  });
});

describe("previousMyDayRange", () => {
  it("returns yesterday MY-time window when called at MY midnight", () => {
    // 2026-05-11 00:00 MY == 2026-05-10 16:00 UTC
    const myMidnight = Date.parse("2026-05-11T00:00:00+08:00");
    const { startMs, endMs, dateLabel } = previousMyDayRange(myMidnight);
    expect(dateLabel).toBe("2026-05-10");
    expect(endMs - startMs).toBe(24 * 60 * 60 * 1000);
    expect(new Date(startMs).toISOString()).toBe("2026-05-09T16:00:00.000Z");
    expect(new Date(endMs).toISOString()).toBe("2026-05-10T16:00:00.000Z");
  });

  it("returns today MY-time window as 'previous' when called mid-day MY", () => {
    // 2026-05-11 14:00 MY -> previous MY day is 2026-05-10
    const myAfternoon = Date.parse("2026-05-11T14:00:00+08:00");
    const { dateLabel } = previousMyDayRange(myAfternoon);
    expect(dateLabel).toBe("2026-05-10");
  });
});
