'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { SquadView } from '@/components/SquadView';
import { cn, formatCurrency } from '@/lib/utils';
import type { Room, RoomMember, User, AuctionPick, Player } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemberWithUser extends RoomMember {}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SquadPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = params?.roomCode ?? '';
  const { user, loading: authLoading } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [allPicks, setAllPicks] = useState<Record<string, AuctionPick[]>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Fetch ──
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

    // Members
    const { data: memberData } = await supabase
      .from('room_members')
      .select('*, user:users(*)')
      .eq('room_id', fetchedRoom.id)
      .order('joined_at', { ascending: true });

    const fetchedMembers = (memberData ?? []) as MemberWithUser[];
    setMembers(fetchedMembers);

    // All picks for the room
    const { data: pickData } = await supabase
      .from('auction_picks')
      .select('*, player:players(*)')
      .eq('room_id', fetchedRoom.id)
      .order('pick_order', { ascending: true });

    const fetchedPicks = (pickData ?? []) as AuctionPick[];

    // Group by user_id
    const grouped: Record<string, AuctionPick[]> = {};
    fetchedPicks.forEach((p) => {
      if (!grouped[p.user_id]) grouped[p.user_id] = [];
      grouped[p.user_id].push(p);
    });
    setAllPicks(grouped);

    // Default to current user's squad
    if (user) setSelectedUserId(user.id);

    setPageLoading(false);
  }, [roomCode, user]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  // ── Guards ──
  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center gap-4">
        <p className="text-xl font-semibold text-white">{error || 'Room not found'}</p>
        <Link href="/dashboard">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const viewingUserId = selectedUserId ?? user?.id ?? null;
  const viewingMember = members.find((m) => m.user_id === viewingUserId);
  const viewingPicks = viewingUserId ? (allPicks[viewingUserId] ?? []) : [];
  const isViewingSelf = viewingUserId === user?.id;

  const budgetSpent = viewingPicks.reduce((sum, p) => sum + (p.bid_amount ?? 0), 0);
  const budgetRemaining = viewingMember?.budget_remaining ?? room.settings.budget - budgetSpent;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-purple-600/6 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-500/4 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Header ── */}
        <div className="mb-6 flex items-center gap-3">
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
            <h1 className="text-2xl font-black text-white">Squad View</h1>
            <p className="text-sm text-slate-400">
              {room.name} &middot; IPL {room.season}
            </p>
          </div>
        </div>

        {/* ── Member Selector Tabs ── */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 pb-1">
            {members.map((m) => {
              const isSelected = viewingUserId === m.user_id;
              const isMe = m.user_id === user?.id;
              const memberPicks = allPicks[m.user_id] ?? [];
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedUserId(m.user_id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-4 py-2.5 border transition-all shrink-0',
                    isSelected
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                      : 'border-white/10 bg-slate-800/40 text-slate-400 hover:text-white hover:border-white/20',
                  )}
                >
                  <Avatar
                    src={m.user?.avatar_url}
                    name={m.user?.display_name ?? m.team_name}
                    size="sm"
                    teamColor={isSelected ? 'ring-amber-400' : undefined}
                  />
                  <div className="text-left">
                    <p className="text-sm font-semibold leading-tight">
                      {isMe ? 'My Squad' : m.team_name}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {memberPicks.length} players
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Squad Header ── */}
        <Card glow={isViewingSelf ? 'gold' : 'none'} className="mb-6">
          <CardBody className="py-4">
            <div className="flex flex-wrap items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  src={viewingMember?.user?.avatar_url}
                  name={viewingMember?.user?.display_name ?? viewingMember?.team_name}
                  size="lg"
                  teamColor={isViewingSelf ? 'ring-amber-400' : 'ring-purple-500'}
                />
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">
                    {isViewingSelf ? 'Your Squad' : "Team"}
                  </p>
                  <h2 className="text-xl font-black text-white">
                    {viewingMember?.team_name ?? '—'}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {viewingMember?.user?.display_name}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 text-center">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                    Budget
                  </span>
                  <span className="text-lg font-black text-white">
                    {formatCurrency(room.settings.budget)}
                  </span>
                </div>
                <div className="w-px bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                    Spent
                  </span>
                  <span className="text-lg font-black text-amber-400">
                    {formatCurrency(budgetSpent)}
                  </span>
                </div>
                <div className="w-px bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                    Remaining
                  </span>
                  <span
                    className={cn(
                      'text-lg font-black',
                      budgetRemaining < room.settings.budget * 0.1
                        ? 'text-red-400'
                        : budgetRemaining < room.settings.budget * 0.3
                        ? 'text-amber-400'
                        : 'text-emerald-400',
                    )}
                  >
                    {formatCurrency(budgetRemaining)}
                  </span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* ── Squad Content ── */}
        <Card>
          <CardBody className="p-5">
            <SquadView
              picks={viewingPicks}
              budget={room.settings.budget}
              budgetSpent={budgetSpent}
              settings={room.settings}
              compact={false}
            />
          </CardBody>
        </Card>

        {/* ── Navigation ── */}
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Link href={`/room/${roomCode}/leaderboard`}>
            <Button variant="secondary" size="sm">
              View Leaderboard
            </Button>
          </Link>
          {room.status === 'draft' && (
            <Link href={`/room/${roomCode}/draft`}>
              <Button size="sm">Back to Draft</Button>
            </Link>
          )}
          {room.status === 'auction' && (
            <Link href={`/room/${roomCode}/auction`}>
              <Button size="sm">Back to Auction</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
