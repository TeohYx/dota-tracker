import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { project, bucketByDay, daysBetween } from "@/lib/calc";
import type { Goal, Match } from "@/lib/types";

function mkMatch(over: Partial<Match> = {}): Match {
  return {
    match_id: 1,
    hero_id: 1,
    start_time: Math.floor(Date.parse("2026-05-11T10:00:00Z") / 1000),
    duration: 1800,
    kills: 5,
    deaths: 5,
    assists: 5,
    win: true,
    game_mode: 22,
    lobby_type: 7,
    ...over
  };
}

const goal: Goal = {
  user_id: 1,
  start_mmr: 4000,
  target_mmr: 5000,
  deadline: "2026-12-31",
  created_at: "2026-01-01T00:00:00Z",
  mmr_per_win: 25
};

describe("daysBetween", () => {
  it("clamps negative spans to 0", () => {
    expect(daysBetween("2026-05-11T00:00:00Z", "2026-05-10T00:00:00Z")).toBe(0);
  });

  it("ceils partial days up", () => {
    expect(daysBetween("2026-05-11T00:00:00Z", "2026-05-11T01:00:00Z")).toBe(1);
  });
});

describe("project", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("flags goal as reached when current MMR >= target", () => {
    const p = project(goal, 5000, []);
    expect(p.reached).toBe(true);
    expect(p.mmr_remaining).toBe(0);
    expect(p.wins_remaining).toBe(0);
    expect(p.progress_pct).toBe(100);
  });

  it("computes progress_pct from start->target gain", () => {
    const p = project(goal, 4500, []);
    expect(p.progress_pct).toBe(50);
    expect(p.mmr_remaining).toBe(500);
    expect(p.wins_remaining).toBe(20);
  });

  it("counts net wins only after goal.created_at", () => {
    const before = mkMatch({
      start_time: Math.floor(Date.parse("2025-12-31T00:00:00Z") / 1000),
      win: true
    });
    const after = mkMatch({
      start_time: Math.floor(Date.parse("2026-02-01T00:00:00Z") / 1000),
      win: true
    });
    const p = project(goal, 4025, [before, after]);
    expect(p.net_wins_so_far).toBe(1);
  });

  it("today_target_wins is at least 1 while goal is unreached", () => {
    const p = project(goal, 4500, []);
    expect(p.today_target_wins).toBeGreaterThanOrEqual(1);
  });

  it("today_complete is true once today_net hits today_target_wins", () => {
    const todayMatches: Match[] = Array.from({ length: 5 }, (_, i) =>
      mkMatch({
        match_id: 100 + i,
        start_time: Math.floor(Date.parse("2026-05-11T08:00:00Z") / 1000) + i,
        win: true
      })
    );
    const p = project(goal, 4500, todayMatches);
    expect(p.today_wins).toBe(5);
    expect(p.today_complete).toBe(true);
  });
});

describe("bucketByDay", () => {
  it("groups matches by UTC date and sorts ascending", () => {
    const matches: Match[] = [
      mkMatch({ match_id: 1, start_time: Math.floor(Date.parse("2026-05-10T01:00:00Z") / 1000), win: true }),
      mkMatch({ match_id: 2, start_time: Math.floor(Date.parse("2026-05-10T03:00:00Z") / 1000), win: false }),
      mkMatch({ match_id: 3, start_time: Math.floor(Date.parse("2026-05-11T10:00:00Z") / 1000), win: true })
    ];
    const out = bucketByDay(matches);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ date: "2026-05-10", wins: 1, losses: 1, net: 0 });
    expect(out[1]).toEqual({ date: "2026-05-11", wins: 1, losses: 0, net: 1 });
  });
});
