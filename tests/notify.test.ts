import { describe, expect, it } from "vitest";
import { composeMatchMessage, composeDailyMessage, previousMyDayRange } from "@/lib/notify";
import type { Match } from "@/lib/types";

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
