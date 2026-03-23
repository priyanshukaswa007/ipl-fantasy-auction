-- ============================================================
-- IPL Fantasy Auction - Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Player',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROOMS / LEAGUES
-- ============================================================
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  host_user_id UUID NOT NULL REFERENCES users(id),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'auction', 'draft', 'active', 'complete')),
  season TEXT NOT NULL DEFAULT 'IPL 2025',
  auction_state JSONB,
  draft_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rooms_code ON rooms(room_code);
CREATE INDEX idx_rooms_host ON rooms(host_user_id);

-- ============================================================
-- ROOM MEMBERS
-- ============================================================
CREATE TABLE room_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  team_name TEXT NOT NULL DEFAULT 'My Team',
  budget_remaining NUMERIC(10,2) NOT NULL DEFAULT 120.00,
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX idx_room_members_room ON room_members(room_id);
CREATE INDEX idx_room_members_user ON room_members(user_id);

-- ============================================================
-- PLAYERS
-- ============================================================
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Batter', 'Bowler', 'All-Rounder', 'Wicketkeeper')),
  nationality TEXT NOT NULL DEFAULT 'Indian',
  country TEXT NOT NULL DEFAULT 'India',
  batting_style TEXT,
  bowling_style TEXT,
  ipl_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0.20,
  rating INTEGER NOT NULL DEFAULT 50 CHECK (rating >= 1 AND rating <= 100),
  photo_url TEXT,
  career_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  season TEXT NOT NULL DEFAULT 'IPL 2025',
  UNIQUE(name, team, season)
);

CREATE INDEX idx_players_team ON players(team);
CREATE INDEX idx_players_role ON players(role);
CREATE INDEX idx_players_season ON players(season);

-- ============================================================
-- AUCTION PICKS
-- ============================================================
CREATE TABLE auction_picks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  user_id UUID NOT NULL REFERENCES users(id),
  bid_amount NUMERIC(10,2) NOT NULL,
  pick_order INTEGER NOT NULL,
  picked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, player_id)
);

CREATE INDEX idx_auction_picks_room ON auction_picks(room_id);
CREATE INDEX idx_auction_picks_user ON auction_picks(user_id);

-- ============================================================
-- MATCH RESULTS
-- ============================================================
CREATE TABLE match_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_number INTEGER NOT NULL,
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  winner TEXT,
  date DATE NOT NULL,
  venue TEXT,
  season TEXT NOT NULL DEFAULT 'IPL 2025',
  UNIQUE(match_number, season)
);

-- ============================================================
-- PLAYER MATCH STATS
-- ============================================================
CREATE TABLE player_match_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id),
  match_id UUID NOT NULL REFERENCES match_results(id) ON DELETE CASCADE,
  runs INTEGER NOT NULL DEFAULT 0,
  balls_faced INTEGER NOT NULL DEFAULT 0,
  fours INTEGER NOT NULL DEFAULT 0,
  sixes INTEGER NOT NULL DEFAULT 0,
  wickets INTEGER NOT NULL DEFAULT 0,
  overs_bowled NUMERIC(4,1) NOT NULL DEFAULT 0,
  runs_conceded INTEGER NOT NULL DEFAULT 0,
  maidens INTEGER NOT NULL DEFAULT 0,
  catches INTEGER NOT NULL DEFAULT 0,
  stumpings INTEGER NOT NULL DEFAULT 0,
  run_outs_direct INTEGER NOT NULL DEFAULT 0,
  run_outs_indirect INTEGER NOT NULL DEFAULT 0,
  potm BOOLEAN NOT NULL DEFAULT FALSE,
  did_not_bat BOOLEAN NOT NULL DEFAULT FALSE,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  fantasy_points INTEGER NOT NULL DEFAULT 0,
  UNIQUE(player_id, match_id)
);

CREATE INDEX idx_player_match_stats_player ON player_match_stats(player_id);
CREATE INDEX idx_player_match_stats_match ON player_match_stats(match_id);

-- ============================================================
-- TRADES
-- ============================================================
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES users(id),
  receiver_id UUID NOT NULL REFERENCES users(id),
  players_offered UUID[] NOT NULL DEFAULT '{}',
  players_requested UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'vetoed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trades_room ON trades(room_id);

-- ============================================================
-- LEADERBOARD CACHE
-- ============================================================
CREATE TABLE leaderboard_cache (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  total_points INTEGER NOT NULL DEFAULT 0,
  last_match_points INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = google_id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (true);

-- Players are readable by everyone
CREATE POLICY "Players are readable by all" ON players FOR SELECT USING (true);

-- Match results are readable by everyone
CREATE POLICY "Match results are readable" ON match_results FOR SELECT USING (true);
CREATE POLICY "Match stats are readable" ON player_match_stats FOR SELECT USING (true);

-- Rooms: members can read rooms they belong to
CREATE POLICY "Room members can read rooms" ON rooms FOR SELECT USING (
  EXISTS (SELECT 1 FROM room_members WHERE room_members.room_id = rooms.id AND room_members.user_id IN (SELECT id FROM users WHERE google_id = auth.uid()::text))
  OR host_user_id IN (SELECT id FROM users WHERE google_id = auth.uid()::text)
);
CREATE POLICY "Anyone can create rooms" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Host can update rooms" ON rooms FOR UPDATE USING (
  host_user_id IN (SELECT id FROM users WHERE google_id = auth.uid()::text)
);

-- Room members
CREATE POLICY "Members can read room members" ON room_members FOR SELECT USING (true);
CREATE POLICY "Anyone can join rooms" ON room_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Members can update own status" ON room_members FOR UPDATE USING (true);

-- Auction picks
CREATE POLICY "Members can read picks" ON auction_picks FOR SELECT USING (true);
CREATE POLICY "Members can insert picks" ON auction_picks FOR INSERT WITH CHECK (true);

-- Trades
CREATE POLICY "Members can read trades" ON trades FOR SELECT USING (true);
CREATE POLICY "Members can create trades" ON trades FOR INSERT WITH CHECK (true);
CREATE POLICY "Members can update trades" ON trades FOR UPDATE USING (true);

-- Leaderboard
CREATE POLICY "Leaderboard is readable" ON leaderboard_cache FOR SELECT USING (true);
CREATE POLICY "Leaderboard is writable" ON leaderboard_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Leaderboard is updatable" ON leaderboard_cache FOR UPDATE USING (true);

-- ============================================================
-- REALTIME
-- ============================================================
-- Enable realtime for rooms and auction_picks
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_picks;
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE trades;
