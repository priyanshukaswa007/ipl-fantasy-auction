'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Room, RoomMember, AuctionPick, User } from '@/types';

// ── Extended types ─────────────────────────────────────────────────────────────

export interface MemberWithUser extends RoomMember {}

export interface PickPlayer {
  id: string;
  name: string;
  team: string;
  role: string;
  nationality: string;
  country: string;
  batting_style: string;
  bowling_style: string;
  ipl_price: number;
  base_price: number;
  rating: number;
  photo_url: string | null;
  career_stats: Record<string, unknown>;
  season: string;
}

export interface PickWithPlayer extends Omit<AuctionPick, 'player'> {
  player?: PickPlayer;
}

export interface UseRoomReturn {
  room: Room | null;
  members: MemberWithUser[];
  myMember: MemberWithUser | null;
  picks: PickWithPlayer[];
  myPicks: PickWithPlayer[];
  isHost: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRoom(roomCode: string): UseRoomReturn {
  const { user } = useAuth();
  const [room, setRoom]       = useState<Room | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [picks, setPicks]     = useState<PickWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Keep stable ref to avoid stale closures in realtime handlers
  const roomRef = useRef<Room | null>(null);
  roomRef.current = room;

  const fetchData = useCallback(async () => {
    if (!roomCode) return;
    const supabase = getSupabaseBrowser();

    // Fetch room
    const { data: roomData, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', roomCode)
      .single();

    if (roomErr || !roomData) {
      setError('Room not found.');
      setLoading(false);
      return;
    }

    const fetchedRoom = roomData as Room;
    setRoom(fetchedRoom);
    setError(null);

    // Fetch members with user info in parallel with picks
    const [memberRes, pickRes] = await Promise.all([
      supabase
        .from('room_members')
        .select('*, user:users(*)')
        .eq('room_id', fetchedRoom.id)
        .order('joined_at', { ascending: true }),
      supabase
        .from('auction_picks')
        .select('*, player:players(*)')
        .eq('room_id', fetchedRoom.id)
        .order('pick_order', { ascending: true }),
    ]);

    setMembers((memberRes.data ?? []) as MemberWithUser[]);
    setPicks((pickRes.data ?? []) as PickWithPlayer[]);
    setLoading(false);
  }, [roomCode]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Realtime: room_members changes
  useEffect(() => {
    if (!room) return;
    const supabase = getSupabaseBrowser();

    const memberChannel = supabase
      .channel(`useRoom:members:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${room.id}`,
        },
        () => { fetchData(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(memberChannel); };
  }, [room, fetchData]);

  // Realtime: auction_picks changes
  useEffect(() => {
    if (!room) return;
    const supabase = getSupabaseBrowser();

    const picksChannel = supabase
      .channel(`useRoom:picks:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_picks',
          filter: `room_id=eq.${room.id}`,
        },
        () => { fetchData(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(picksChannel); };
  }, [room, fetchData]);

  // Derived values
  const myMember = user ? (members.find((m) => m.user_id === user.id) ?? null) : null;
  const myPicks  = user ? picks.filter((p) => p.user_id === user.id) : [];
  const isHost   = !!(user && room && user.id === room.host_user_id);

  return {
    room,
    members,
    myMember,
    picks,
    myPicks,
    isHost,
    loading,
    error,
    refetch: fetchData,
  };
}
