-- ============================================================
-- Migration 002: Fix RLS policies, add indexes, fix season
-- ============================================================

-- ── Fix season default to IPL 2026 ──────────────────────────
ALTER TABLE rooms ALTER COLUMN season SET DEFAULT 'IPL 2026';

-- ── Drop broken RLS policies ────────────────────────────────
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Room members can read rooms" ON rooms;
DROP POLICY IF EXISTS "Host can update rooms" ON rooms;
DROP POLICY IF EXISTS "Members can update own status" ON room_members;
DROP POLICY IF EXISTS "Members can update trades" ON trades;

-- ── Recreate with correct auth.uid() (returns UUID, matches users.id) ──

-- Users: can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- Rooms: members can read rooms they belong to
DROP POLICY IF EXISTS "Room members can read rooms" ON rooms;
CREATE POLICY "Room members can read rooms" ON rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = rooms.id
      AND room_members.user_id = auth.uid()
    )
    OR host_user_id = auth.uid()
  );

-- Rooms: host can update
CREATE POLICY "Host can update rooms" ON rooms
  FOR UPDATE USING (host_user_id = auth.uid());

-- Room members: can update own membership
CREATE POLICY "Members can update own status" ON room_members
  FOR UPDATE USING (user_id = auth.uid());

-- Trades: only proposer/receiver can update
CREATE POLICY "Trade parties can update" ON trades
  FOR UPDATE USING (
    proposer_id = auth.uid() OR receiver_id = auth.uid()
  );

-- ── Add missing indexes for performance ─────────────────────
CREATE INDEX IF NOT EXISTS idx_trades_proposer ON trades(proposer_id);
CREATE INDEX IF NOT EXISTS idx_trades_receiver ON trades(receiver_id);
CREATE INDEX IF NOT EXISTS idx_auction_picks_room_user ON auction_picks(room_id, user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_room ON leaderboard_cache(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room_user ON room_members(room_id, user_id);

-- ── Allow service role to bypass RLS for API routes ─────────
-- (Service role already bypasses RLS by default in Supabase,
--  but this ensures our score update APIs work correctly)

-- Allow match_results INSERT/UPDATE for service role (score updates)
DROP POLICY IF EXISTS "Match results are insertable" ON match_results;
CREATE POLICY "Match results are insertable" ON match_results
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Match results are updatable" ON match_results;
CREATE POLICY "Match results are updatable" ON match_results
  FOR UPDATE USING (true);

-- Allow player_match_stats INSERT/UPDATE for service role
DROP POLICY IF EXISTS "Match stats are insertable" ON player_match_stats;
CREATE POLICY "Match stats are insertable" ON player_match_stats
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Match stats are updatable" ON player_match_stats;
CREATE POLICY "Match stats are updatable" ON player_match_stats
  FOR UPDATE USING (true);
