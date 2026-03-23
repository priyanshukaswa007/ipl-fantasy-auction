'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Leaderboard } from '@/components/Leaderboard';
import { cn, timeAgo } from '@/lib/utils';
import type { Room, RoomMember, User, LeaderboardEntry } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemberWithUser extends RoomMember {}

// ── Season Progress ───────────────────────────────────────────────────────────

const IPL_TOTAL_MATCHES = 74;

function SeasonProgress({ played }: { played: number }) {
  const pct = Math.min(100, (played / IPL_TOTAL_MATCHES) * 100);
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">
          Season Progress
        </span>
        <span className="text-xs text-slate-400">
          {played} / {IPL_TOTAL_MATCHES} matches
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #a855f7 0%, #f59e0b 100%)',
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-600">IPL Start</span>
        <span className="text-[10px] text-slate-600">Final</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = params?.roomCode ?? '';
  const { user, loading: authLoading } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [matchesPlayed, setMatchesPlayed] = useState(0);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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

    setMembers((memberData ?? []) as MemberWithUser[]);

    // Leaderboard cache — join with user data
    const { data: lbData } = await supabase
      .from('leaderboard_cache')
      .select('*, user:users(*)')
      .eq('room_id', fetchedRoom.id)
      .order('rank', { ascending: true });

    const fetchedEntries = (lbData ?? []) as LeaderboardEntry[];
    setEntries(fetchedEntries);

    if (fetchedEntries.length > 0) {
      const latest = fetchedEntries.reduce(
        (acc, e) =>
          new Date(e.updated_at) > new Date(acc) ? e.updated_at : acc,
        fetchedEntries[0].updated_at,
      );
      setLastUpdated(latest);
    }

    // Count matches played for season progress
    const { count } = await supabase
      .from('match_results')
      .select('*', { count: 'exact', head: true })
      .eq('season', fetchedRoom.season);

    setMatchesPlayed(count ?? 0);
    setPageLoading(false);
  }, [roomCode]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  // ── Realtime: leaderboard_cache ──
  useEffect(() => {
    if (!room) return;
    const supabase = getSupabaseBrowser();

    const channel = supabase
      .channel(`leaderboard:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaderboard_cache',
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, fetchData]);

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

  const hasMatches = matchesPlayed > 0;
  const myEntry = entries.find((e) => e.user_id === user?.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-purple-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Header ── */}
        <div className="mb-6 flex flex-wrap items-start gap-3 justify-between">
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
              <h1 className="text-2xl font-black text-white">Leaderboard</h1>
              <p className="text-sm text-slate-400">
                {room.name} &middot; IPL {room.season}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-slate-500 border border-white/10 rounded-lg px-3 py-1.5 bg-slate-900/50">
                Updated {timeAgo(lastUpdated)}
              </span>
            )}
            <Link href={`/room/${roomCode}/squad`}>
              <Button variant="secondary" size="sm">
                View Squads
              </Button>
            </Link>
          </div>
        </div>

        {/* ── My Rank Snapshot ── */}
        {myEntry && hasMatches && (
          <Card glow="gold" className="mb-6">
            <CardBody className="py-4">
              <div className="flex flex-wrap items-center gap-4 justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">
                    Your Rank
                  </p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-amber-400">
                      {myEntry.rank}
                    </span>
                    <span className="text-slate-500 text-sm mb-1.5">
                      of {entries.length}
                    </span>
                  </div>
                </div>
                <div className="flex gap-5 text-center">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Total
                    </p>
                    <p className="text-xl font-black text-white">
                      {myEntry.total_points.toLocaleString()}
                    </p>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Last Match
                    </p>
                    <p
                      className={cn(
                        'text-xl font-black',
                        myEntry.last_match_points > 0
                          ? 'text-emerald-400'
                          : 'text-slate-500',
                      )}
                    >
                      {myEntry.last_match_points > 0
                        ? `+${myEntry.last_match_points}`
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* ── Season Progress ── */}
        <Card className="mb-6">
          <CardBody>
            <SeasonProgress played={matchesPlayed} />
          </CardBody>
        </Card>

        {/* ── Leaderboard ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-amber-400"
                  aria-hidden="true"
                >
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
                Season Standings
              </h2>
              {entries.length > 0 && (
                <span className="text-xs text-slate-500">
                  {entries.length} teams
                </span>
              )}
            </div>
          </CardHeader>
          <CardBody>
            {!hasMatches ? (
              /* Empty state */
              <div className="text-center py-16 flex flex-col items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-slate-800/60 border border-white/10 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-slate-600"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Season hasn't started
                  </h3>
                  <p className="text-sm text-slate-500 max-w-xs">
                    Points will appear here once IPL matches begin and results
                    are recorded.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 justify-center mt-2">
                  <Link href={`/room/${roomCode}/squad`}>
                    <Button variant="secondary" size="sm">
                      View Squads
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <Leaderboard
                entries={entries}
                members={members}
                expandedUserId={expandedUserId}
                onRowClick={(uid) =>
                  setExpandedUserId((prev) => (prev === uid ? null : uid))
                }
              />
            )}
          </CardBody>
        </Card>

        {/* ── Navigation ── */}
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Link href={`/room/${roomCode}/squad`}>
            <Button variant="ghost" size="sm">
              My Squad
            </Button>
          </Link>
          {room.settings.trade_window !== 'closed' && (
            <Link href={`/room/${roomCode}/trades`}>
              <Button variant="ghost" size="sm">
                Trades
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
