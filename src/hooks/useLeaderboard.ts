'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { LeaderboardEntry, User, RoomMember } from '@/types';

// ── Extended entry type ────────────────────────────────────────────────────────

export interface LeaderboardEntryFull extends LeaderboardEntry {
  user?: User;
  member?: RoomMember;
}

export interface UseLeaderboardReturn {
  entries: LeaderboardEntryFull[];
  loading: boolean;
  error: string | null;
  recalculate: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLeaderboard(roomId: string): UseLeaderboardReturn {
  const [entries, setEntries]   = useState<LeaderboardEntryFull[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    if (!roomId) return;
    const supabase = getSupabaseBrowser();

    const { data, error: fetchErr } = await supabase
      .from('leaderboard_cache')
      .select('*, user:users(*), member:room_members!leaderboard_cache_user_id_fkey(*)')
      .eq('room_id', roomId)
      .order('rank', { ascending: true });

    if (fetchErr) {
      setError(fetchErr.message);
      setLoading(false);
      return;
    }

    setEntries((data ?? []) as LeaderboardEntryFull[]);
    setError(null);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Realtime: leaderboard_cache changes
  useEffect(() => {
    if (!roomId) return;
    const supabase = getSupabaseBrowser();

    const channel = supabase
      .channel(`useLeaderboard:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaderboard_cache',
          filter: `room_id=eq.${roomId}`,
        },
        () => { fetchLeaderboard(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchLeaderboard]);

  // Recalculate: fetch all member picks, sum fantasy points, upsert leaderboard_cache
  const recalculate = useCallback(async () => {
    if (!roomId || recalculating) return;
    setRecalculating(true);

    const supabase = getSupabaseBrowser();

    try {
      // Get all room members
      const { data: members, error: membersErr } = await supabase
        .from('room_members')
        .select('id, user_id')
        .eq('room_id', roomId);

      if (membersErr || !members) throw new Error(membersErr?.message ?? 'Failed to fetch members');

      // Get all auction picks with fantasy_points from player_match_stats
      const { data: picks, error: picksErr } = await supabase
        .from('auction_picks')
        .select('user_id, player_id')
        .eq('room_id', roomId);

      if (picksErr || !picks) throw new Error(picksErr?.message ?? 'Failed to fetch picks');

      // Get all player_match_stats for players in this room
      const playerIds = [...new Set(picks.map((p) => p.player_id))];

      const { data: allStats, error: statsErr } = playerIds.length > 0
        ? await supabase
            .from('player_match_stats')
            .select('player_id, fantasy_points')
            .in('player_id', playerIds)
        : { data: [], error: null };

      if (statsErr) throw new Error(statsErr.message);

      // Build a map: player_id -> total fantasy_points
      const playerPoints: Record<string, number> = {};
      for (const stat of (allStats ?? [])) {
        playerPoints[stat.player_id] = (playerPoints[stat.player_id] ?? 0) + (stat.fantasy_points ?? 0);
      }

      // Calculate per-user totals
      const userTotals: Record<string, number> = {};
      for (const pick of picks) {
        userTotals[pick.user_id] = (userTotals[pick.user_id] ?? 0) + (playerPoints[pick.player_id] ?? 0);
      }

      // Sort descending for rank
      const sorted = members
        .map((m) => ({ user_id: m.user_id, total_points: userTotals[m.user_id] ?? 0 }))
        .sort((a, b) => b.total_points - a.total_points);

      // Upsert leaderboard_cache
      const upsertRows = sorted.map((row, idx) => ({
        room_id: roomId,
        user_id: row.user_id,
        total_points: row.total_points,
        last_match_points: 0,
        rank: idx + 1,
        updated_at: new Date().toISOString(),
      }));

      if (upsertRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('leaderboard_cache')
          .upsert(upsertRows, { onConflict: 'room_id,user_id' });

        if (upsertErr) throw new Error(upsertErr.message);
      }

      await fetchLeaderboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recalculation failed');
    } finally {
      setRecalculating(false);
    }
  }, [roomId, recalculating, fetchLeaderboard]);

  return {
    entries,
    loading: loading || recalculating,
    error,
    recalculate,
  };
}
