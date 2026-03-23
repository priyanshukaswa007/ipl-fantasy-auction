'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { PlayerCard } from '@/components/PlayerCard';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import type {
  Room,
  RoomMember,
  User,
  Player,
  AuctionPick,
  DraftState,
  PlayerRole,
  IPLTeam,
} from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftPick {
  round: number;
  pick_number: number;
  player: Player;
  user_id: string;
  display_name: string;
  team_name: string;
  picked_at: string;
}

interface MemberWithUser extends RoomMember {}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSnakeTurnOrder(memberIds: string[], round: number): string[] {
  if (round % 2 === 0) {
    return [...memberIds].reverse();
  }
  return [...memberIds];
}

function getPickNumberInRound(pickIndex: number, memberCount: number): number {
  return (pickIndex % memberCount) + 1;
}

function getRoundFromPickIndex(pickIndex: number, memberCount: number): number {
  return Math.floor(pickIndex / memberCount) + 1;
}

const ROLE_LABELS: Record<PlayerRole, string> = {
  Batter: 'Batters',
  Bowler: 'Bowlers',
  'All-Rounder': 'All-Rounders',
  Wicketkeeper: 'Wicketkeepers',
};

// ── Timer Component ───────────────────────────────────────────────────────────

function CountdownTimer({
  seconds,
  total,
  onExpire,
  running,
}: {
  seconds: number;
  total: number;
  onExpire: () => void;
  running: boolean;
}) {
  const pct = total > 0 ? (seconds / total) * 100 : 0;
  const color =
    seconds <= 10 ? '#ef4444' : seconds <= 20 ? '#f59e0b' : '#22c55e';

  useEffect(() => {
    if (running && seconds <= 0) onExpire();
  }, [seconds, running, onExpire]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{ width: 72, height: 72 }}
      >
        {/* Track */}
        <svg
          className="absolute inset-0 -rotate-90"
          width="72"
          height="72"
          viewBox="0 0 72 72"
        >
          <circle
            cx="36"
            cy="36"
            r="30"
            fill="none"
            stroke="#1e293b"
            strokeWidth="5"
          />
          <circle
            cx="36"
            cy="36"
            r="30"
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 30}`}
            strokeDashoffset={`${2 * Math.PI * 30 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <span
          className="relative z-10 text-xl font-black tabular-nums"
          style={{ color }}
        >
          {seconds}
        </span>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-slate-500">
        seconds
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DraftPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = params?.roomCode ?? '';
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // ── Data state ──
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [picks, setPicks] = useState<AuctionPick[]>([]);
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Draft state ──
  const [draftState, setDraftState] = useState<DraftState>({
    status: 'not_started',
    current_turn_user_id: null,
    turn_order: [],
    current_round: 1,
    current_pick: 0,
    direction: 'forward',
    timer_remaining: 60,
  });
  const [isPaused, setIsPaused] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Filter state ──
  const [filterRole, setFilterRole] = useState<PlayerRole | 'All'>('All');
  const [filterTeam, setFilterTeam] = useState<IPLTeam | 'All'>('All');
  const [search, setSearch] = useState('');

  // ── UI state ──
  const [pickingPlayerId, setPickingPlayerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'history' | 'squad'>('available');
  const picksEndRef = useRef<HTMLDivElement>(null);

  // ── Derived ──
  const pickedPlayerIds = new Set(picks.map((p) => p.player_id));
  const availablePlayers = allPlayers.filter((p) => !pickedPlayerIds.has(p.id));
  const myMember = members.find((m) => m.user_id === user?.id);
  const isHost = room?.host_user_id === user?.id;
  const isMyTurn = draftState.current_turn_user_id === user?.id;
  const totalDraftPicks =
    members.length > 0 && room
      ? members.length * (room.settings.squad_size_max ?? 18)
      : 0;
  const draftComplete =
    draftState.status === 'completed' ||
    (totalDraftPicks > 0 && picks.length >= totalDraftPicks);

  const myPicks = picks.filter((p) => p.user_id === user?.id);
  const mySquadPlayers = myPicks.map((p) => p.player).filter(Boolean) as Player[];

  // ── Filtered players ──
  const filteredPlayers = availablePlayers.filter((p) => {
    const matchRole = filterRole === 'All' || p.role === filterRole;
    const matchTeam = filterTeam === 'All' || p.team === filterTeam;
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.team.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchTeam && matchSearch;
  });

  // ── Data fetch ──
  const fetchData = useCallback(async () => {
    if (!roomCode) return;
    const supabase = getSupabaseBrowser();

    const { data: roomData, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', roomCode)
      .single();

    if (roomErr || !roomData) {
      setError('Room not found.');
      setPageLoading(false);
      return;
    }

    const fetchedRoom = roomData as Room;
    setRoom(fetchedRoom);
    const timerSec = fetchedRoom.settings.draft_timer_seconds ?? 60;
    setTimerSeconds(timerSec);

    // Members
    const { data: memberData } = await supabase
      .from('room_members')
      .select('*, user:users(*)')
      .eq('room_id', fetchedRoom.id)
      .order('joined_at', { ascending: true });

    const fetchedMembers = (memberData ?? []) as MemberWithUser[];
    setMembers(fetchedMembers);

    // Players for this season
    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('season', fetchedRoom.season)
      .order('rating', { ascending: false });

    setAllPlayers((playerData ?? []) as Player[]);

    // Existing picks
    const { data: pickData } = await supabase
      .from('auction_picks')
      .select('*, player:players(*), user:users(*)')
      .eq('room_id', fetchedRoom.id)
      .order('pick_order', { ascending: true });

    const fetchedPicks = (pickData ?? []) as AuctionPick[];
    setPicks(fetchedPicks);

    // Build draft pick history
    const memberCount = fetchedMembers.length;
    if (memberCount > 0) {
      const initialOrder = fetchedMembers.map((m) => m.user_id);
      const history: DraftPick[] = fetchedPicks.map((p, idx) => {
        const round = getRoundFromPickIndex(idx, memberCount);
        const member = fetchedMembers.find((m) => m.user_id === p.user_id);
        return {
          round,
          pick_number: idx + 1,
          player: p.player as Player,
          user_id: p.user_id,
          display_name: member?.user?.display_name ?? 'Unknown',
          team_name: member?.team_name ?? 'Unknown',
          picked_at: p.picked_at,
        };
      });
      setDraftPicks(history);

      // Compute current draft state from picks
      if (fetchedPicks.length < totalDraftPicks || totalDraftPicks === 0) {
        const pickIdx = fetchedPicks.length;
        const currentRound = getRoundFromPickIndex(pickIdx, memberCount);
        const snakeOrder = buildSnakeTurnOrder(initialOrder, currentRound);
        const posInRound = getPickNumberInRound(pickIdx, memberCount);
        const currentTurnUserId = snakeOrder[posInRound - 1] ?? null;

        setDraftState({
          status: fetchedRoom.status === 'draft' ? 'in_progress' : 'not_started',
          current_turn_user_id: currentTurnUserId,
          turn_order: snakeOrder,
          current_round: currentRound,
          current_pick: pickIdx + 1,
          direction: currentRound % 2 === 0 ? 'reverse' : 'forward',
          timer_remaining: timerSec,
        });
      } else {
        setDraftState((prev) => ({ ...prev, status: 'completed' }));
      }
    }

    setPageLoading(false);
  }, [roomCode, totalDraftPicks]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  // ── Realtime broadcast ──
  useEffect(() => {
    if (!room) return;
    const supabase = getSupabaseBrowser();

    const channel = supabase
      .channel(`draft:${room.id}`)
      .on('broadcast', { event: 'draft_pick' }, ({ payload }) => {
        const newPick = payload as AuctionPick & { player: Player; member: MemberWithUser };
        setPicks((prev) => {
          if (prev.some((p) => p.id === newPick.id)) return prev;
          return [...prev, newPick];
        });
        setDraftPicks((prev) => {
          const idx = prev.length;
          const memberCount = members.length;
          const round = getRoundFromPickIndex(idx, memberCount);
          const member = members.find((m) => m.user_id === newPick.user_id);
          return [
            ...prev,
            {
              round,
              pick_number: idx + 1,
              player: newPick.player,
              user_id: newPick.user_id,
              display_name: member?.user?.display_name ?? 'Unknown',
              team_name: member?.team_name ?? 'Unknown',
              picked_at: newPick.picked_at,
            },
          ];
        });
        // Advance turn
        setDraftState((prev) => {
          const pickIdx = prev.current_pick; // after this pick
          const memberCount = members.length;
          const currentRound = getRoundFromPickIndex(pickIdx, memberCount);
          const baseOrder = members.map((m) => m.user_id);
          const snakeOrder = buildSnakeTurnOrder(baseOrder, currentRound);
          const posInRound = getPickNumberInRound(pickIdx, memberCount);
          const nextUserId = snakeOrder[posInRound] ?? null;
          return {
            ...prev,
            current_turn_user_id: nextUserId,
            current_round: currentRound,
            current_pick: pickIdx + 1,
            direction: currentRound % 2 === 0 ? 'reverse' : 'forward',
            timer_remaining: room.settings.draft_timer_seconds ?? 60,
          };
        });
        setTimerSeconds(room.settings.draft_timer_seconds ?? 60);
      })
      .on('broadcast', { event: 'draft_pause' }, () => setIsPaused(true))
      .on('broadcast', { event: 'draft_resume' }, () => setIsPaused(false))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, members]);

  // ── Timer logic ──
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (
      draftState.status !== 'in_progress' ||
      isPaused ||
      draftComplete
    ) {
      return;
    }

    setTimerSeconds(room?.settings.draft_timer_seconds ?? 60);

    timerRef.current = setInterval(() => {
      setTimerSeconds((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftState.current_turn_user_id, isPaused, draftState.status]);

  // Scroll pick history to bottom
  useEffect(() => {
    picksEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [draftPicks]);

  // ── Auto pick on timer expire ──
  const handleTimerExpire = useCallback(async () => {
    if (!isMyTurn || !room || !myMember) return;
    const compositionRules = room.settings.composition_rules;
    const myPickedPlayers = mySquadPlayers;

    const overseasCount = myPickedPlayers.filter(
      (p) =>
        !['indian', 'india'].includes(
          (p.nationality ?? p.country ?? '').toLowerCase(),
        ),
    ).length;

    const candidate = availablePlayers.find((p) => {
      if (compositionRules.enabled) {
        const isOverseas = !['indian', 'india'].includes(
          (p.nationality ?? p.country ?? '').toLowerCase(),
        );
        if (isOverseas && overseasCount >= compositionRules.max_overseas) return false;
      }
      return true;
    });

    if (candidate) {
      await performPick(candidate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, availablePlayers, mySquadPlayers, room, myMember]);

  // ── Pick a player ──
  const performPick = async (player: Player) => {
    if (!room || !user || !myMember || pickingPlayerId) return;
    if (!isMyTurn) return;

    setPickingPlayerId(player.id);
    const supabase = getSupabaseBrowser();

    const pickOrder = picks.length + 1;
    const bidAmount = player.base_price;

    const { data: insertedPick, error: pickErr } = await supabase
      .from('auction_picks')
      .insert({
        room_id: room.id,
        player_id: player.id,
        user_id: user.id,
        bid_amount: bidAmount,
        pick_order: pickOrder,
        picked_at: new Date().toISOString(),
      })
      .select('*, player:players(*), user:users(*)')
      .single();

    if (pickErr || !insertedPick) {
      setPickingPlayerId(null);
      return;
    }

    // Update member budget
    await supabase
      .from('room_members')
      .update({ budget_remaining: myMember.budget_remaining - bidAmount })
      .eq('id', myMember.id);

    // Broadcast to others
    await supabase.channel(`draft:${room.id}`).send({
      type: 'broadcast',
      event: 'draft_pick',
      payload: insertedPick,
    });

    setPickingPlayerId(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // ── Pause / Resume (host only) ──
  const handlePauseResume = async () => {
    if (!room || !isHost) return;
    const supabase = getSupabaseBrowser();
    const event = isPaused ? 'draft_resume' : 'draft_pause';
    await supabase.channel(`draft:${room.id}`).send({
      type: 'broadcast',
      event,
      payload: {},
    });
    setIsPaused(!isPaused);
  };

  // ── Guards ──
  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center gap-4">
        <p className="text-xl font-semibold text-white">{error}</p>
        <Link href="/dashboard">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  if (!room) return null;

  const timerTotal = room.settings.draft_timer_seconds ?? 60;
  const currentMember = members.find(
    (m) => m.user_id === draftState.current_turn_user_id,
  );

  const roleFilters: Array<PlayerRole | 'All'> = [
    'All',
    'Batter',
    'Bowler',
    'All-Rounder',
    'Wicketkeeper',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Ambient glows */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-purple-600/6 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Header ── */}
        <div className="mb-6 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/room/${roomCode}`}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label="Back"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-black text-white">
                Snake Draft
              </h1>
              <p className="text-sm text-slate-400">
                {room.name} &middot; Round {draftState.current_round} &middot; Pick{' '}
                {draftState.current_pick}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {draftComplete && (
              <Badge variant="success">Draft Complete</Badge>
            )}
            {isPaused && !draftComplete && (
              <Badge variant="warning">Paused</Badge>
            )}
            {isHost && !draftComplete && (
              <Button
                size="sm"
                variant={isPaused ? 'primary' : 'secondary'}
                onClick={handlePauseResume}
              >
                {isPaused ? 'Resume Draft' : 'Pause Draft'}
              </Button>
            )}
          </div>
        </div>

        {/* ── Current Turn Banner ── */}
        <div
          className={cn(
            'mb-6 rounded-2xl border px-6 py-4',
            'transition-all duration-500',
            isMyTurn && !draftComplete && !isPaused
              ? 'border-amber-400/50 bg-amber-400/10 shadow-lg shadow-amber-500/20'
              : 'border-white/10 bg-slate-900/60',
          )}
        >
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <Avatar
                src={currentMember?.user?.avatar_url}
                name={currentMember?.user?.display_name ?? currentMember?.team_name}
                size="lg"
                teamColor={isMyTurn ? 'ring-amber-400' : undefined}
              />
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-0.5">
                  {draftComplete
                    ? 'Draft Complete'
                    : isPaused
                    ? 'Draft Paused'
                    : 'Now Picking'}
                </p>
                <p
                  className={cn(
                    'text-xl font-black',
                    isMyTurn && !draftComplete ? 'text-amber-400' : 'text-white',
                  )}
                >
                  {draftComplete
                    ? 'All picks complete!'
                    : currentMember?.user?.display_name ??
                      currentMember?.team_name ??
                      '—'}
                  {isMyTurn && !draftComplete && (
                    <span className="ml-2 text-sm font-medium text-amber-300">
                      (You)
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {currentMember?.team_name}
                </p>
              </div>
            </div>

            {!draftComplete && !isPaused && (
              <CountdownTimer
                seconds={timerSeconds}
                total={timerTotal}
                onExpire={handleTimerExpire}
                running={isMyTurn && !isPaused}
              />
            )}
          </div>
        </div>

        {/* ── Turn Order Strip ── */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex items-center gap-2 pb-2">
            {draftState.turn_order.map((uid, i) => {
              const member = members.find((m) => m.user_id === uid);
              const isCurrent = uid === draftState.current_turn_user_id;
              const isMe = uid === user?.id;
              return (
                <div
                  key={uid}
                  className={cn(
                    'relative flex flex-col items-center gap-1 flex-shrink-0 rounded-xl px-3 py-2 border transition-all',
                    isCurrent
                      ? 'border-amber-400/60 bg-amber-400/10 scale-105'
                      : 'border-white/8 bg-slate-800/40',
                  )}
                >
                  <Avatar
                    src={member?.user?.avatar_url}
                    name={member?.user?.display_name}
                    size="sm"
                    teamColor={isCurrent ? 'ring-amber-400' : undefined}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-bold truncate max-w-[60px]',
                      isCurrent ? 'text-amber-300' : 'text-slate-400',
                    )}
                  >
                    {isMe ? 'You' : member?.team_name ?? 'P' + (i + 1)}
                  </span>
                  {isCurrent && (
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Main Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* ── Left: Player pool + history (mobile tabs) ── */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Mobile tab nav */}
            <div className="flex lg:hidden gap-1 bg-slate-900/60 rounded-xl p-1 border border-white/10">
              {(['available', 'history', 'squad'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-xs font-semibold uppercase tracking-wide transition-all',
                    activeTab === tab
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-500 hover:text-slate-300',
                  )}
                >
                  {tab === 'available'
                    ? `Available (${filteredPlayers.length})`
                    : tab === 'history'
                    ? `History (${draftPicks.length})`
                    : `My Squad (${mySquadPlayers.length})`}
                </button>
              ))}
            </div>

            {/* Available Players */}
            <div className={cn('flex flex-col gap-4', activeTab !== 'available' && 'hidden lg:flex')}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <h2 className="font-bold text-white">
                      Available Players
                      <span className="ml-2 text-sm text-slate-400 font-normal">
                        ({filteredPlayers.length} / {availablePlayers.length})
                      </span>
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {/* Search */}
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name or team..."
                        className="text-xs rounded-lg px-3 py-1.5 bg-slate-800 text-white border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none placeholder:text-slate-500 w-44"
                      />
                      {/* Role filter */}
                      <select
                        value={filterRole}
                        onChange={(e) =>
                          setFilterRole(e.target.value as PlayerRole | 'All')
                        }
                        className="text-xs rounded-lg px-2 py-1.5 bg-slate-800 text-white border border-slate-700 focus:border-amber-500 outline-none"
                      >
                        {roleFilters.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardBody>
                  {filteredPlayers.length === 0 ? (
                    <p className="text-center text-slate-500 py-12 text-sm">
                      No players match your filters.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-4 justify-start">
                      {filteredPlayers.map((player) => {
                        const canPick =
                          isMyTurn &&
                          !draftComplete &&
                          !isPaused &&
                          !pickingPlayerId;
                        return (
                          <div key={player.id} className="relative">
                            <PlayerCard
                              player={player}
                              size="sm"
                              onClick={canPick ? () => performPick(player) : undefined}
                            />
                            {pickingPlayerId === player.id && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl z-30">
                                <div className="h-6 w-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                              </div>
                            )}
                            {!canPick && isMyTurn && (
                              <div className="absolute inset-0 rounded-2xl z-10" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Pick History */}
            <div className={cn('flex flex-col', activeTab !== 'history' && 'hidden lg:flex')}>
              <Card>
                <CardHeader>
                  <h2 className="font-bold text-white">
                    Pick History
                    <span className="ml-2 text-sm text-slate-400 font-normal">
                      ({draftPicks.length} picks)
                    </span>
                  </h2>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="max-h-80 overflow-y-auto">
                    {draftPicks.length === 0 ? (
                      <p className="text-center text-slate-500 text-sm py-8">
                        No picks yet. Draft will begin shortly.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 px-4 text-xs text-slate-500 uppercase tracking-wide font-medium">
                              Pick
                            </th>
                            <th className="text-left py-2 px-4 text-xs text-slate-500 uppercase tracking-wide font-medium">
                              Player
                            </th>
                            <th className="text-left py-2 px-4 text-xs text-slate-500 uppercase tracking-wide font-medium hidden sm:table-cell">
                              Role
                            </th>
                            <th className="text-left py-2 px-4 text-xs text-slate-500 uppercase tracking-wide font-medium">
                              Picked By
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...draftPicks].reverse().map((dp) => (
                            <tr
                              key={dp.pick_number}
                              className={cn(
                                'border-b border-white/5 transition-colors',
                                dp.user_id === user?.id
                                  ? 'bg-amber-400/5'
                                  : 'hover:bg-white/3',
                              )}
                            >
                              <td className="py-2 px-4 text-slate-400 tabular-nums">
                                <span className="text-xs text-slate-600">
                                  R{dp.round}
                                </span>{' '}
                                #{dp.pick_number}
                              </td>
                              <td className="py-2 px-4">
                                <div className="font-semibold text-white truncate max-w-[140px]">
                                  {dp.player?.name ?? '—'}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {dp.player?.team}
                                </div>
                              </td>
                              <td className="py-2 px-4 hidden sm:table-cell">
                                <Badge variant="default">
                                  {dp.player?.role}
                                </Badge>
                              </td>
                              <td className="py-2 px-4">
                                <div
                                  className={cn(
                                    'text-sm font-medium truncate max-w-[120px]',
                                    dp.user_id === user?.id
                                      ? 'text-amber-300'
                                      : 'text-slate-300',
                                  )}
                                >
                                  {dp.user_id === user?.id
                                    ? 'You'
                                    : dp.team_name}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <div ref={picksEndRef} />
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>

          {/* ── Right sidebar: My Squad ── */}
          <div className={cn('flex flex-col gap-4', activeTab !== 'squad' && 'hidden lg:flex')}>
            <Card glow="purple" className="sticky top-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-white">My Squad</h2>
                  <Badge variant={mySquadPlayers.length >= (room.settings.squad_size_min ?? 18) ? 'success' : 'default'}>
                    {mySquadPlayers.length} players
                  </Badge>
                </div>
              </CardHeader>
              <CardBody className="p-3">
                {/* Budget */}
                <div className="mb-3 rounded-xl bg-slate-800/60 border border-white/10 px-4 py-3 flex justify-between text-sm">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Budget Left
                    </p>
                    <p className="font-bold text-amber-400">
                      {formatCurrency(myMember?.budget_remaining ?? 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Spent
                    </p>
                    <p className="font-bold text-white">
                      {formatCurrency(
                        (room.settings.budget ?? 120) -
                          (myMember?.budget_remaining ?? room.settings.budget ?? 120),
                      )}
                    </p>
                  </div>
                </div>

                {/* Grouped by role */}
                {(['Wicketkeeper', 'Batter', 'All-Rounder', 'Bowler'] as PlayerRole[]).map(
                  (role) => {
                    const rolePlayers = mySquadPlayers.filter(
                      (p) => p.role === role,
                    );
                    if (rolePlayers.length === 0) return null;
                    return (
                      <div key={role} className="mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 px-1">
                          {ROLE_LABELS[role]} ({rolePlayers.length})
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {rolePlayers.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center gap-2 rounded-lg bg-slate-800/50 border border-white/5 px-2 py-1.5"
                            >
                              <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                                {getInitials(p.name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate">
                                  {p.name}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {p.team}
                                </p>
                              </div>
                              <span className="text-[10px] font-bold text-amber-400 shrink-0">
                                {formatCurrency(p.base_price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  },
                )}

                {mySquadPlayers.length === 0 && (
                  <p className="text-center text-slate-600 text-xs py-8">
                    No picks yet. Your players will appear here.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
