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
  deadline: string;
  created_at: string;
  mmr_per_win: number;
};

export type GoalProjection = {
  goal: Goal;
  current_mmr: number;
  // Overall remaining-to-target
  mmr_remaining: number;
  wins_remaining: number;
  days_remaining: number;
  mmr_per_day_needed: number;
  wins_per_day_needed: number;
  // Progress so far
  net_wins_so_far: number;
  expected_net_wins_so_far: number;
  progress_pct: number;
  on_track: boolean;
  reached: boolean;
  // Today
  today_wins: number;
  today_losses: number;
  today_net: number;
  today_target_wins: number;
  today_complete: boolean;
};
