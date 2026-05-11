import type { Match, PlayerSummary, Profile } from "./types";

const BASE = "https://api.opendota.com/api";

const RANK_TIER_LABELS: Record<number, string> = {
  10: "Herald", 20: "Guardian", 30: "Crusader", 40: "Archon",
  50: "Legend", 60: "Ancient", 70: "Divine", 80: "Immortal"
};

// Approximate MMR midpoints for each rank star (used only when computed_mmr is null).
// Source: community-derived medal-to-MMR ranges (Valve does not publish exact mappings).
const RANK_TO_MMR: Record<number, number> = {
  11: 150, 12: 300, 13: 450, 14: 600, 15: 750,
  21: 900, 22: 1050, 23: 1200, 24: 1350, 25: 1500,
  31: 1650, 32: 1800, 33: 1950, 34: 2100, 35: 2250,
  41: 2400, 42: 2550, 43: 2700, 44: 2850, 45: 3000,
  51: 3150, 52: 3300, 53: 3450, 54: 3600, 55: 3750,
  61: 3900, 62: 4050, 63: 4200, 64: 4350, 65: 4500,
  71: 4650, 72: 4800, 73: 4950, 74: 5100, 75: 5300,
  80: 5620
};

function rankLabel(rankTier: number | null): string {
  if (!rankTier) return "Uncalibrated";
  const tier = Math.floor(rankTier / 10) * 10;
  const star = rankTier % 10;
  const base = RANK_TIER_LABELS[tier] ?? "Unknown";
  if (tier === 80) return "Immortal";
  return `${base}${star ? ` ${star}` : ""}`;
}

function deriveMmr(rankTier: number | null, computedMmr: number | null): number {
  if (computedMmr) return Math.round(computedMmr);
  if (rankTier && RANK_TO_MMR[rankTier]) return RANK_TO_MMR[rankTier];
  return 0;
}

async function odFetch(path: string, opts: { cacheSeconds?: number } = {}) {
  const key = process.env.OPENDOTA_API_KEY;
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${key ? `${sep}api_key=${key}` : ""}`;
  const cacheSeconds = opts.cacheSeconds ?? 30;
  const res = await fetch(url, {
    cache: cacheSeconds === 0 ? "no-store" : "default",
    next: cacheSeconds > 0 ? { revalidate: cacheSeconds } : undefined,
    headers: { Accept: "application/json" }
  });
  if (!res.ok) {
    throw new Error(`OpenDota ${path} ${res.status}`);
  }
  return res.json();
}

export async function fetchPlayerSummary(accountId: number): Promise<PlayerSummary> {
  const [player, wl] = await Promise.all([
    odFetch(`/players/${accountId}`),
    odFetch(`/players/${accountId}/wl`)
  ]);
  const profile: Profile = {
    account_id: player.profile?.account_id ?? accountId,
    personaname: player.profile?.personaname ?? null,
    avatarfull: player.profile?.avatarfull ?? null,
    loccountrycode: player.profile?.loccountrycode ?? null,
    profileurl: player.profile?.profileurl ?? null
  };
  const rank_tier = player.rank_tier ?? null;
  const computed_mmr = player.computed_mmr ?? null;
  const total = (wl.win ?? 0) + (wl.lose ?? 0);
  return {
    profile,
    rank_tier,
    leaderboard_rank: player.leaderboard_rank ?? null,
    computed_mmr,
    derived_mmr: deriveMmr(rank_tier, computed_mmr),
    rank_label: rankLabel(rank_tier),
    wins: wl.win ?? 0,
    losses: wl.lose ?? 0,
    total,
    win_rate: total ? (wl.win ?? 0) / total : 0
  };
}

let heroNameCache: { ts: number; map: Map<number, string> } | null = null;
const HERO_CACHE_MS = 24 * 60 * 60 * 1000;

export async function fetchHeroNames(): Promise<Map<number, string>> {
  if (heroNameCache && Date.now() - heroNameCache.ts < HERO_CACHE_MS) {
    return heroNameCache.map;
  }
  try {
    const data = await odFetch(`/heroes`, { cacheSeconds: HERO_CACHE_MS / 1000 });
    const arr: any[] = Array.isArray(data) ? data : [];
    const map = new Map<number, string>();
    for (const h of arr) {
      if (typeof h?.id === "number" && typeof h?.localized_name === "string") {
        map.set(h.id, h.localized_name);
      }
    }
    heroNameCache = { ts: Date.now(), map };
    return map;
  } catch {
    return heroNameCache?.map ?? new Map();
  }
}

export async function getHeroName(heroId: number): Promise<string> {
  const map = await fetchHeroNames();
  return map.get(heroId) ?? `Hero ${heroId}`;
}

export async function fetchMatches(
  accountId: number,
  opts: { days?: number; limit?: number } = {}
): Promise<Match[]> {
  const days = opts.days ?? 90;
  const limit = opts.limit ?? 500;
  const params = new URLSearchParams({
    significant: "0",
    limit: String(limit)
  });
  if (days > 0) params.set("date", String(days));
  const data = await odFetch(
    `/players/${accountId}/matches?${params.toString()}`,
    { cacheSeconds: 0 }
  );
  const arr: any[] = Array.isArray(data) ? data : [];
  return arr.map((m) => {
    const isRadiant = m.player_slot < 128;
    return {
      match_id: m.match_id,
      hero_id: m.hero_id,
      start_time: m.start_time,
      duration: m.duration,
      kills: m.kills,
      deaths: m.deaths,
      assists: m.assists,
      win: isRadiant === !!m.radiant_win,
      game_mode: m.game_mode,
      lobby_type: m.lobby_type
    };
  });
}
