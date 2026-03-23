// ============================================================
// IPL Fantasy Auction - Type Definitions
// ============================================================

export interface User {
  id: string;
  google_id?: string;
  email?: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export type RoomStatus = 'waiting' | 'auction' | 'draft' | 'active' | 'complete';
export type AuctionMode = 'live_auction' | 'snake_draft';

export interface CompositionRules {
  max_overseas: number;
  min_wicketkeepers: number;
  min_batters: number;
  min_bowlers: number;
  min_allrounders: number;
  enabled: boolean;
}

export interface RoomSettings {
  budget: number;
  squad_size_min: number;
  squad_size_max: number;
  max_players: number;
  auction_mode: AuctionMode;
  composition_rules: CompositionRules;
  bid_increment: number;
  timer_seconds: number;
  draft_timer_seconds: number;
  rtm_enabled: boolean;
  trade_window: 'always' | 'between_matches' | 'closed';
  commissioner_mode: boolean;
  player_order: 'random' | 'price_desc' | 'by_role';
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  budget: 120,
  squad_size_min: 18,
  squad_size_max: 25,
  max_players: 10,
  auction_mode: 'live_auction',
  composition_rules: {
    max_overseas: 8,
    min_wicketkeepers: 2,
    min_batters: 3,
    min_bowlers: 3,
    min_allrounders: 1,
    enabled: true,
  },
  bid_increment: 0.25,
  timer_seconds: 15,
  draft_timer_seconds: 60,
  rtm_enabled: false,
  trade_window: 'always',
  commissioner_mode: false,
  player_order: 'random',
};

export interface Room {
  id: string;
  room_code: string;
  name: string;
  host_user_id: string;
  settings: RoomSettings;
  status: RoomStatus;
  season: string;
  created_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  team_name: string;
  budget_remaining: number;
  is_ready: boolean;
  joined_at: string;
  user?: User;
}

export type PlayerRole = 'Batter' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper';
export type IPLTeam = 'CSK' | 'MI' | 'RCB' | 'KKR' | 'DC' | 'PBKS' | 'RR' | 'GT' | 'LSG' | 'SRH';

export interface PlayerCareerStats {
  matches: number;
  runs: number;
  wickets: number;
  batting_avg: number;
  batting_sr: number;
  bowling_avg: number;
  economy: number;
  highest_score: number;
  best_bowling: string;
  fifties: number;
  hundreds: number;
}

export interface Player {
  id: string;
  name: string;
  team: IPLTeam;
  role: PlayerRole;
  nationality: string;
  country: string;
  batting_style: string;
  bowling_style: string;
  ipl_price: number;
  base_price: number;
  rating: number;
  photo_url: string | null;
  career_stats: PlayerCareerStats;
  season: string;
}

export interface AuctionPick {
  id: string;
  room_id: string;
  player_id: string;
  user_id: string;
  bid_amount: number;
  pick_order: number;
  picked_at: string;
  player?: Player;
  user?: User;
}

export interface MatchResult {
  id: string;
  match_number: number;
  team_a: IPLTeam;
  team_b: IPLTeam;
  winner: IPLTeam | null;
  date: string;
  venue: string;
  season: string;
}

export interface PlayerMatchStats {
  id: string;
  player_id: string;
  match_id: string;
  runs: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  wickets: number;
  overs_bowled: number;
  runs_conceded: number;
  maidens: number;
  catches: number;
  stumpings: number;
  run_outs_direct: number;
  run_outs_indirect: number;
  potm: boolean;
  did_not_bat: boolean;
  is_winner: boolean;
  fantasy_points: number;
  player?: Player;
  match?: MatchResult;
}

export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'vetoed';

export interface Trade {
  id: string;
  room_id: string;
  proposer_id: string;
  receiver_id: string;
  players_offered: string[];
  players_requested: string[];
  status: TradeStatus;
  created_at: string;
  proposer?: User;
  receiver?: User;
}

export interface LeaderboardEntry {
  room_id: string;
  user_id: string;
  total_points: number;
  last_match_points: number;
  rank: number;
  updated_at: string;
  user?: User;
  member?: RoomMember;
}

// Auction real-time event types
export type AuctionEventType =
  | 'auction_start'
  | 'player_nominated'
  | 'bid_placed'
  | 'bid_warning'
  | 'player_sold'
  | 'player_unsold'
  | 'auction_pause'
  | 'auction_resume'
  | 'auction_end';

export interface AuctionEvent {
  type: AuctionEventType;
  room_id: string;
  player_id?: string;
  user_id?: string;
  bid_amount?: number;
  timer_remaining?: number;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface AuctionState {
  status: 'not_started' | 'in_progress' | 'paused' | 'completed';
  current_player_id: string | null;
  current_bid: number;
  current_bidder_id: string | null;
  timer_remaining: number;
  sold_count: number;
  unsold_count: number;
  unsold_players: string[];
  round: number;
  pick_order: number;
}

// Draft types
export interface DraftState {
  status: 'not_started' | 'in_progress' | 'completed';
  current_turn_user_id: string | null;
  turn_order: string[];
  current_round: number;
  current_pick: number;
  direction: 'forward' | 'reverse';
  timer_remaining: number;
}

// Team color map
export const TEAM_COLORS: Record<string, { primary: string; secondary: string; bg: string }> = {
  CSK: { primary: '#FFCB05', secondary: '#0081E9', bg: '#FFCB0515' },
  MI: { primary: '#004BA0', secondary: '#D1AB3E', bg: '#004BA015' },
  RCB: { primary: '#EC1C24', secondary: '#2B2A29', bg: '#EC1C2415' },
  KKR: { primary: '#3A225D', secondary: '#B3A123', bg: '#3A225D15' },
  DC: { primary: '#004C93', secondary: '#EF1B23', bg: '#004C9315' },
  PBKS: { primary: '#ED1B24', secondary: '#A7A9AC', bg: '#ED1B2415' },
  RR: { primary: '#EA1A85', secondary: '#254AA5', bg: '#EA1A8515' },
  GT: { primary: '#1C1C1C', secondary: '#A0E3F4', bg: '#1C1C1C15' },
  LSG: { primary: '#A72056', secondary: '#FFCC00', bg: '#A7205615' },
  SRH: { primary: '#FF822A', secondary: '#000000', bg: '#FF822A15' },
};

export const TEAM_FULL_NAMES: Record<string, string> = {
  CSK: 'Chennai Super Kings',
  MI: 'Mumbai Indians',
  RCB: 'Royal Challengers Bengaluru',
  KKR: 'Kolkata Knight Riders',
  DC: 'Delhi Capitals',
  PBKS: 'Punjab Kings',
  RR: 'Rajasthan Royals',
  GT: 'Gujarat Titans',
  LSG: 'Lucknow Super Giants',
  SRH: 'Sunrisers Hyderabad',
};
