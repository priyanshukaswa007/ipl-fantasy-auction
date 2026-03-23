'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { AuctionEngine } from '@/lib/auction-engine';
import type {
  AuctionState,
  Player,
  RoomMember,
  AuctionPick,
  Room,
  AuctionEvent,
} from '@/types';

// ── Return type ───────────────────────────────────────────────────────────────

export interface UseAuctionReturn {
  auctionState: AuctionState;
  currentPlayer: Player | null;
  members: RoomMember[];
  picks: AuctionPick[];
  allPlayers: Player[];
  availablePlayers: Player[];
  myMember: RoomMember | null;
  myPicks: AuctionPick[];
  isHost: boolean;
  loading: boolean;
  room: Room | null;
  placeBid: (customAmount?: number) => Promise<void>;
  nominatePlayer: (playerId: string) => Promise<void>;
  nominateNext: () => Promise<void>;
  markSold: () => Promise<void>;
  markUnsold: () => Promise<void>;
  pauseAuction: () => Promise<void>;
  resumeAuction: () => Promise<void>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuction(roomCode: string): UseAuctionReturn {
  const { user } = useAuth();
  const supabase = getSupabaseBrowser();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [room, setRoom] = useState<Room | null>(null);
  const [auctionState, setAuctionState] = useState<AuctionState>(
    AuctionEngine.createInitialState(),
  );
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [picks, setPicks] = useState<AuctionPick[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Timer ───────────────────────────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerActiveRef = useRef(false);

  // ── Throttle bid ────────────────────────────────────────────────────────────
  const lastBidTimeRef = useRef(0);

  // ── Stable ref for markSold/markUnsold (breaks circular useCallback deps) ───
  const markSoldInternalRef = useRef<((roomId: string, state: AuctionState) => Promise<void>) | null>(null);
  const markUnsoldInternalRef = useRef<((roomId: string, state: AuctionState) => Promise<void>) | null>(null);

  // ── Stable refs for callbacks that need fresh state ─────────────────────────
  const auctionStateRef = useRef(auctionState);
  const roomRef = useRef(room);
  const membersRef = useRef(members);
  const allPlayersRef = useRef(allPlayers);
  const picksRef = useRef(picks);

  useEffect(() => { auctionStateRef.current = auctionState; }, [auctionState]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { membersRef.current = members; }, [members]);
  useEffect(() => { allPlayersRef.current = allPlayers; }, [allPlayers]);
  useEffect(() => { picksRef.current = picks; }, [picks]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const isHost = !!(user && room && user.id === room.host_user_id);
  const myMember = members.find((m) => m.user_id === user?.id) ?? null;
  const myPicks = picks.filter((p) => p.user_id === user?.id);

  const soldPlayerIds = new Set(picks.map((p) => p.player_id));
  const availablePlayers = allPlayers.filter(
    (p) =>
      !soldPlayerIds.has(p.id) &&
      !auctionState.unsold_players.includes(p.id),
  );

  // ── Broadcast helpers ────────────────────────────────────────────────────────

  const getChannel = useCallback(
    (roomId: string) => supabase.channel(`auction:${roomId}`),
    [supabase],
  );

  const broadcast = useCallback(
    async (roomId: string, event: AuctionEvent) => {
      const channel = getChannel(roomId);
      await channel.send({
        type: 'broadcast',
        event: event.type,
        payload: event,
      });
    },
    [getChannel],
  );

  // ── Persist auction state to DB ──────────────────────────────────────────────

  const persistAuctionState = useCallback(
    async (roomId: string, state: AuctionState) => {
      await supabase
        .from('rooms')
        .update({ auction_state: state })
        .eq('id', roomId);
    },
    [supabase],
  );

  // ── Timer management ─────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerActiveRef.current = false;
  }, []);

  const startTimer = useCallback(
    (seconds: number, onComplete: () => void) => {
      stopTimer();
      setAuctionState((prev) => ({ ...prev, timer_remaining: seconds }));
      timerActiveRef.current = true;

      timerRef.current = setInterval(() => {
        setAuctionState((prev) => {
          if (prev.status === 'paused' || !timerActiveRef.current) {
            return prev;
          }
          const next = prev.timer_remaining - 1;
          if (next <= 0) {
            stopTimer();
            onComplete();
            return { ...prev, timer_remaining: 0 };
          }
          return { ...prev, timer_remaining: next };
        });
      }, 1000);
    },
    [stopTimer],
  );

  // ── Auto sold/unsold when timer hits 0 ───────────────────────────────────────

  const handleTimerComplete = useCallback(async () => {
    const state = auctionStateRef.current;
    const currentRoom = roomRef.current;
    if (!currentRoom || !isHost) return;

    if (state.current_bidder_id) {
      // Someone bid — mark sold
      await markSoldInternalRef.current?.(currentRoom.id, state);
    } else {
      // No bids — mark unsold
      await markUnsoldInternalRef.current?.(currentRoom.id, state);
    }
  }, [isHost]);

  // ── Initial data fetch ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomCode || !user) return;

    let cancelled = false;

    (async () => {
      // 1. Fetch room
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode)
        .single();

      if (roomErr || !roomData || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }

      const fetchedRoom = roomData as Room & { auction_state?: AuctionState };
      if (!cancelled) setRoom(fetchedRoom);

      // 2. Fetch members with user data
      const { data: membersData } = await supabase
        .from('room_members')
        .select('*, user:users(*)')
        .eq('room_id', fetchedRoom.id)
        .order('joined_at', { ascending: true });

      if (!cancelled) setMembers((membersData ?? []) as RoomMember[]);

      // 3. Fetch all players for the season
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('season', fetchedRoom.season);

      if (!cancelled) setAllPlayers((playersData ?? []) as Player[]);

      // 4. Fetch existing picks
      const { data: picksData } = await supabase
        .from('auction_picks')
        .select('*, player:players(*), user:users(*)')
        .eq('room_id', fetchedRoom.id)
        .order('pick_order', { ascending: true });

      if (!cancelled) setPicks((picksData ?? []) as AuctionPick[]);

      // 5. Load auction_state from room
      if (fetchedRoom.auction_state) {
        const savedState = fetchedRoom.auction_state as AuctionState;
        if (!cancelled) {
          setAuctionState(savedState);

          // If state references a current player, resolve it
          if (savedState.current_player_id && playersData) {
            const cp = (playersData as Player[]).find(
              (p) => p.id === savedState.current_player_id,
            );
            if (cp && !cancelled) setCurrentPlayer(cp);
          }
        }
      }

      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [roomCode, user, supabase]);

  // ── Realtime subscription ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!room) return;

    const channel = supabase.channel(`auction:${room.id}`);

    channel
      .on('broadcast', { event: 'player_nominated' }, ({ payload }) => {
        const event = payload as AuctionEvent;
        const player = allPlayersRef.current.find(
          (p) => p.id === event.player_id,
        );
        setCurrentPlayer(player ?? null);
        setAuctionState((prev) => ({
          ...prev,
          status: 'in_progress',
          current_player_id: event.player_id ?? null,
          current_bid: player?.base_price ?? 0,
          current_bidder_id: null,
          timer_remaining: event.timer_remaining ?? 15,
        }));
        if (isHost) {
          startTimer(
            event.timer_remaining ?? 15,
            handleTimerComplete,
          );
        } else {
          // Non-hosts sync their local timer from the broadcast
          setAuctionState((prev) => ({
            ...prev,
            timer_remaining: event.timer_remaining ?? 15,
          }));
        }
      })

      .on('broadcast', { event: 'bid_placed' }, ({ payload }) => {
        const event = payload as AuctionEvent;
        setAuctionState((prev) => ({
          ...prev,
          current_bid: event.bid_amount ?? prev.current_bid,
          current_bidder_id: event.user_id ?? null,
          timer_remaining: event.timer_remaining ?? prev.timer_remaining,
        }));
        // Reset timer on all clients
        if (!isHost) {
          setAuctionState((prev) => ({
            ...prev,
            timer_remaining: event.timer_remaining ?? prev.timer_remaining,
          }));
        } else {
          const timerSecs =
            event.timer_remaining ??
            (roomRef.current?.settings.timer_seconds ?? 15);
          startTimer(timerSecs, handleTimerComplete);
        }
      })

      .on('broadcast', { event: 'player_sold' }, ({ payload }) => {
        const event = payload as AuctionEvent;
        stopTimer();

        // Add to picks
        if (event.data?.pick) {
          setPicks((prev) => [...prev, event.data!.pick as AuctionPick]);
        }

        // Update buyer's budget in members
        if (event.user_id && event.bid_amount !== undefined) {
          setMembers((prev) =>
            prev.map((m) =>
              m.user_id === event.user_id
                ? {
                    ...m,
                    budget_remaining: parseFloat(
                      (m.budget_remaining - event.bid_amount!).toFixed(2),
                    ),
                  }
                : m,
            ),
          );
        }

        setAuctionState((prev) => ({
          ...prev,
          current_player_id: null,
          current_bid: 0,
          current_bidder_id: null,
          timer_remaining: 0,
          sold_count: prev.sold_count + 1,
        }));
        setCurrentPlayer(null);
      })

      .on('broadcast', { event: 'player_unsold' }, ({ payload }) => {
        const event = payload as AuctionEvent;
        stopTimer();
        setAuctionState((prev) => ({
          ...prev,
          current_player_id: null,
          current_bid: 0,
          current_bidder_id: null,
          timer_remaining: 0,
          unsold_count: prev.unsold_count + 1,
          unsold_players: [
            ...prev.unsold_players,
            event.player_id ?? '',
          ].filter(Boolean),
        }));
        setCurrentPlayer(null);
      })

      .on('broadcast', { event: 'auction_pause' }, () => {
        stopTimer();
        setAuctionState((prev) => ({ ...prev, status: 'paused' }));
      })

      .on('broadcast', { event: 'auction_resume' }, ({ payload }) => {
        const event = payload as AuctionEvent;
        setAuctionState((prev) => ({
          ...prev,
          status: 'in_progress',
          timer_remaining: event.timer_remaining ?? prev.timer_remaining,
        }));
        if (isHost) {
          startTimer(
            event.timer_remaining ?? auctionStateRef.current.timer_remaining,
            handleTimerComplete,
          );
        }
      })

      .on('broadcast', { event: 'auction_end' }, () => {
        stopTimer();
        setAuctionState((prev) => ({ ...prev, status: 'completed' }));
      })

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, isHost]);

  // ── Public actions ────────────────────────────────────────────────────────────

  const placeBid = useCallback(async (customAmount?: number) => {
    const currentRoom = roomRef.current;
    const state = auctionStateRef.current;
    if (!currentRoom || !user || !myMember) return;

    // Rate-limit: no more than once per 2 seconds
    const now = Date.now();
    if (now - lastBidTimeRef.current < 2000) return;
    lastBidTimeRef.current = now;

    const myPlayerPicks = picksRef.current
      .filter((p) => p.user_id === user.id)
      .map((p) => p.player as Player)
      .filter(Boolean);

    const cp = currentPlayer;
    const permission = cp
      ? AuctionEngine.canBidForPlayer(
          myMember,
          cp,
          state,
          currentRoom.settings,
          myPlayerPicks,
        )
      : AuctionEngine.canBid(myMember, state, currentRoom.settings, myPlayerPicks);

    if (!permission.allowed) return;

    // Use custom amount if provided (for quick-increment buttons), otherwise use default increment
    const nextBid = customAmount
      ? Math.round(customAmount * 100) / 100
      : AuctionEngine.getNextBid(state.current_bid, currentRoom.settings.bid_increment);

    // Validate custom amount is higher than current bid
    if (nextBid <= state.current_bid) return;

    // Budget check for custom amount
    if (nextBid > myMember.budget_remaining) return;

    // Optimistically update local state
    setAuctionState((prev) => ({
      ...prev,
      current_bid: nextBid,
      current_bidder_id: user.id,
    }));

    const timerReset = currentRoom.settings.timer_seconds;

    const event: AuctionEvent = {
      type: 'bid_placed',
      room_id: currentRoom.id,
      player_id: state.current_player_id ?? undefined,
      user_id: user.id,
      bid_amount: nextBid,
      timer_remaining: timerReset,
      timestamp: new Date().toISOString(),
    };

    await broadcast(currentRoom.id, event);

    // Persist updated auction state
    const newState: AuctionState = {
      ...state,
      current_bid: nextBid,
      current_bidder_id: user.id,
      timer_remaining: timerReset,
    };
    await persistAuctionState(currentRoom.id, newState);
  }, [user, myMember, currentPlayer, broadcast, persistAuctionState]);

  const nominatePlayer = useCallback(
    async (playerId: string) => {
      const currentRoom = roomRef.current;
      if (!currentRoom || !isHost) return;

      const player = allPlayersRef.current.find((p) => p.id === playerId);
      if (!player) return;

      const timerSecs = currentRoom.settings.timer_seconds;

      setCurrentPlayer(player);
      const newState: AuctionState = {
        ...auctionStateRef.current,
        status: 'in_progress',
        current_player_id: playerId,
        current_bid: player.base_price,
        current_bidder_id: null,
        timer_remaining: timerSecs,
      };
      setAuctionState(newState);
      await persistAuctionState(currentRoom.id, newState);

      const event: AuctionEvent = {
        type: 'player_nominated',
        room_id: currentRoom.id,
        player_id: playerId,
        timer_remaining: timerSecs,
        timestamp: new Date().toISOString(),
      };
      await broadcast(currentRoom.id, event);

      startTimer(timerSecs, handleTimerComplete);
    },
    [isHost, broadcast, persistAuctionState, startTimer, handleTimerComplete],
  );

  const nominateNext = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom || !isHost) return;

    const soldIds = new Set(picksRef.current.map((p) => p.player_id));
    const unsoldIds = new Set(auctionStateRef.current.unsold_players);
    const available = allPlayersRef.current.filter(
      (p) => !soldIds.has(p.id) && !unsoldIds.has(p.id),
    );

    if (available.length === 0) {
      // All players done — end auction
      await endAuctionInternal(currentRoom.id);
      return;
    }

    // Sort according to room setting and pick next
    const sorted = AuctionEngine.sortPlayersForAuction(
      available,
      currentRoom.settings.player_order,
    );
    const nextPlayer = sorted[auctionStateRef.current.pick_order % sorted.length];
    await nominatePlayer(nextPlayer.id);

    setAuctionState((prev) => ({
      ...prev,
      pick_order: prev.pick_order + 1,
    }));
  }, [isHost, nominatePlayer]);

  // ── Internal sold/unsold (used by both host actions & timer) ─────────────────

  const markSoldInternal = useCallback(
    async (roomId: string, state: AuctionState) => {
      if (!state.current_player_id || !state.current_bidder_id) return;

      const player = allPlayersRef.current.find(
        (p) => p.id === state.current_player_id,
      );
      const buyer = membersRef.current.find(
        (m) => m.user_id === state.current_bidder_id,
      );
      if (!player || !buyer) return;

      // Insert auction_pick record
      const newPick: Omit<AuctionPick, 'id' | 'picked_at'> = {
        room_id: roomId,
        player_id: player.id,
        user_id: buyer.user_id,
        bid_amount: state.current_bid,
        pick_order: picksRef.current.length + 1,
      };

      const { data: pickData } = await supabase
        .from('auction_picks')
        .insert(newPick)
        .select('*, player:players(*), user:users(*)')
        .single();

      // Update buyer's budget_remaining in DB
      const newBudget = parseFloat(
        (buyer.budget_remaining - state.current_bid).toFixed(2),
      );
      await supabase
        .from('room_members')
        .update({ budget_remaining: newBudget })
        .eq('id', buyer.id);

      const insertedPick = (pickData ?? { ...newPick, id: crypto.randomUUID(), picked_at: new Date().toISOString() }) as AuctionPick;

      const newState: AuctionState = {
        ...state,
        current_player_id: null,
        current_bid: 0,
        current_bidder_id: null,
        timer_remaining: 0,
        sold_count: state.sold_count + 1,
      };

      await persistAuctionState(roomId, newState);

      const event: AuctionEvent = {
        type: 'player_sold',
        room_id: roomId,
        player_id: player.id,
        user_id: buyer.user_id,
        bid_amount: state.current_bid,
        timer_remaining: 0,
        timestamp: new Date().toISOString(),
        data: { pick: insertedPick },
      };
      await broadcast(roomId, event);
    },
    [supabase, broadcast, persistAuctionState],
  );

  const markUnsoldInternal = useCallback(
    async (roomId: string, state: AuctionState) => {
      if (!state.current_player_id) return;

      const newState: AuctionState = {
        ...state,
        current_player_id: null,
        current_bid: 0,
        current_bidder_id: null,
        timer_remaining: 0,
        unsold_count: state.unsold_count + 1,
        unsold_players: [...state.unsold_players, state.current_player_id],
      };
      await persistAuctionState(roomId, newState);

      const event: AuctionEvent = {
        type: 'player_unsold',
        room_id: roomId,
        player_id: state.current_player_id,
        timer_remaining: 0,
        timestamp: new Date().toISOString(),
      };
      await broadcast(roomId, event);
    },
    [broadcast, persistAuctionState],
  );

  // Keep refs in sync so handleTimerComplete can call them without circular deps
  useEffect(() => { markSoldInternalRef.current = markSoldInternal; }, [markSoldInternal]);
  useEffect(() => { markUnsoldInternalRef.current = markUnsoldInternal; }, [markUnsoldInternal]);

  const endAuctionInternal = useCallback(
    async (roomId: string) => {
      stopTimer();
      const newState: AuctionState = {
        ...auctionStateRef.current,
        status: 'completed',
      };
      setAuctionState(newState);
      await persistAuctionState(roomId, newState);
      await supabase.from('rooms').update({ status: 'active' }).eq('id', roomId);

      const event: AuctionEvent = {
        type: 'auction_end',
        room_id: roomId,
        timestamp: new Date().toISOString(),
      };
      await broadcast(roomId, event);
    },
    [stopTimer, broadcast, persistAuctionState, supabase],
  );

  // ── Public host actions ───────────────────────────────────────────────────────

  const markSold = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom || !isHost) return;
    await markSoldInternal(currentRoom.id, auctionStateRef.current);
  }, [isHost, markSoldInternal]);

  const markUnsold = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom || !isHost) return;
    await markUnsoldInternal(currentRoom.id, auctionStateRef.current);
  }, [isHost, markUnsoldInternal]);

  const pauseAuction = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom || !isHost) return;
    stopTimer();

    const newState: AuctionState = { ...auctionStateRef.current, status: 'paused' };
    setAuctionState(newState);
    await persistAuctionState(currentRoom.id, newState);

    const event: AuctionEvent = {
      type: 'auction_pause',
      room_id: currentRoom.id,
      timestamp: new Date().toISOString(),
    };
    await broadcast(currentRoom.id, event);
  }, [isHost, stopTimer, broadcast, persistAuctionState]);

  const resumeAuction = useCallback(async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom || !isHost) return;

    const timerSecs = auctionStateRef.current.timer_remaining || currentRoom.settings.timer_seconds;
    const newState: AuctionState = {
      ...auctionStateRef.current,
      status: 'in_progress',
      timer_remaining: timerSecs,
    };
    setAuctionState(newState);
    await persistAuctionState(currentRoom.id, newState);

    const event: AuctionEvent = {
      type: 'auction_resume',
      room_id: currentRoom.id,
      timer_remaining: timerSecs,
      timestamp: new Date().toISOString(),
    };
    await broadcast(currentRoom.id, event);
    startTimer(timerSecs, handleTimerComplete);
  }, [isHost, broadcast, persistAuctionState, startTimer, handleTimerComplete]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    return () => { stopTimer(); };
  }, [stopTimer]);

  return {
    auctionState,
    currentPlayer,
    members,
    picks,
    allPlayers,
    availablePlayers,
    myMember,
    myPicks,
    isHost,
    loading,
    room,
    placeBid,
    nominatePlayer,
    nominateNext,
    markSold,
    markUnsold,
    pauseAuction,
    resumeAuction,
  };
}

export default useAuction;
