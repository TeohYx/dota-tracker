export type Profile = {
  account_id: number;
  personaname: string | null;
  avatarfull: string | null;
  loccountrycode: string | null;
  profileurl: string | null;
};

export type PlayerSummary = {
  profile: Profile;
  rank_tier: number | null;
  leaderboard_rank: number | null;
  computed_mmr: number | null;
  derived_mmr: number;
  rank_label: string;
  wins: number;
  losses: number;
  total: number;
  win_rate: number;
};

export type Match = {
  match_id: number;
  hero_id: number;
  start_time: number;
  duration: number;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  game_mode: number;
  lobby_type: number;
};

export type Goal = {
  account_id: number;
  start_mmr: number;
  target_mmr: number;
  deadline: string; // ISO date (yyyy-mm-dd)
  created_at: string; // ISO datetime
  mmr_per_win: number;
};

export type GoalProjection = {
  goal: Goal;
  current_mmr: number;
  mmr_remaining: number;
  wins_remaining: number;
  days_remaining: number;
  net_wins_per_day: number;
  on_track: boolean;
  net_wins_so_far: number;
  expected_net_wins_so_far: number;
};
