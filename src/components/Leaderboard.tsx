'use client';

import { useState, useRef, useEffect } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { LeaderboardEntry, RoomMember, User } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LeaderboardProps {
  entries: LeaderboardEntry[];
  members: RoomMember[];
  onRowClick?: (userId: string) => void;
  expandedUserId?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const RANK_STYLES: Record<number, { bg: string; border: string; text: string; glow: string }> = {
  1: {
    bg: 'bg-gradient-to-r from-yellow-900/40 to-amber-900/20',
    border: 'border-yellow-500/40',
    text: 'text-yellow-400',
    glow: 'shadow-lg shadow-yellow-500/20',
  },
  2: {
    bg: 'bg-gradient-to-r from-slate-700/40 to-slate-800/20',
    border: 'border-slate-400/30',
    text: 'text-slate-300',
    glow: 'shadow-md shadow-slate-400/10',
  },
  3: {
    bg: 'bg-gradient-to-r from-orange-900/30 to-amber-900/10',
    border: 'border-orange-600/30',
    text: 'text-orange-400',
    glow: 'shadow-md shadow-orange-500/15',
  },
};

const RANK_MEDAL: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

// ── Podium ────────────────────────────────────────────────────────────────────

function Podium({
  entries,
  members,
}: {
  entries: LeaderboardEntry[];
  members: RoomMember[];
}) {
  const top3 = entries.slice(0, 3);
  if (top3.length < 2) return null;

  // Re-order for podium display: 2nd | 1st | 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights = [top3[1] ? 'h-20' : 'h-0', 'h-28', top3[2] ? 'h-14' : 'h-0'];
  const heightMap = [heights[0], heights[1], heights[2]];

  return (
    <div className="mb-8 flex items-end justify-center gap-4">
      {podiumOrder.map((entry, i) => {
        const isFirst = entry.rank === 1;
        const podiumHeight = isFirst ? heights[1] : entry.rank === 2 ? heights[0] : heights[2];
        const member = members.find((m) => m.user_id === entry.user_id);
        const styles = RANK_STYLES[entry.rank] ?? {
          bg: 'bg-slate-800',
          border: 'border-white/10',
          text: 'text-white',
          glow: '',
        };

        return (
          <div key={entry.user_id} className="flex flex-col items-center gap-2">
            <span className="text-2xl" aria-hidden="true">
              {RANK_MEDAL[entry.rank] ?? ''}
            </span>
            <Avatar
              src={entry.user?.avatar_url}
              name={entry.user?.display_name ?? member?.team_name}
              size={isFirst ? 'lg' : 'md'}
              teamColor={isFirst ? 'ring-yellow-400' : undefined}
            />
            <div className="text-center">
              <p className="text-xs font-bold text-white truncate max-w-[80px]">
                {member?.team_name ?? entry.user?.display_name ?? '—'}
              </p>
              <p className={cn('text-sm font-black', styles.text)}>
                {entry.total_points.toLocaleString()} pts
              </p>
            </div>
            {/* Podium block */}
            <div
              className={cn(
                'w-20 rounded-t-xl border flex items-center justify-center',
                styles.bg,
                styles.border,
                styles.glow,
                podiumHeight,
              )}
            >
              <span className={cn('text-2xl font-black', styles.text)}>
                {entry.rank}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Trend Arrow ───────────────────────────────────────────────────────────────

function TrendArrow({ direction }: { direction: 'up' | 'down' | 'same' }) {
  if (direction === 'up') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-400"
        aria-label="Moved up"
      >
        <path d="m18 15-6-6-6 6" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-red-400"
        aria-label="Moved down"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-600"
      aria-label="No change"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  member,
  isExpanded,
  onClick,
  previousRanks,
}: {
  entry: LeaderboardEntry;
  member: MemberWithUser | undefined;
  isExpanded: boolean;
  onClick: () => void;
  previousRanks: Record<string, number>;
}) {
  const prevRank = previousRanks[entry.user_id];
  const trend: 'up' | 'down' | 'same' =
    prevRank === undefined || prevRank === entry.rank
      ? 'same'
      : prevRank > entry.rank
      ? 'up'
      : 'down';

  const rankStyles = RANK_STYLES[entry.rank] ?? {
    bg: '',
    border: 'border-white/8',
    text: 'text-white',
    glow: '',
  };

  const lastMatchDisplay =
    entry.last_match_points > 0
      ? `+${entry.last_match_points}`
      : entry.last_match_points < 0
      ? `${entry.last_match_points}`
      : '—';

  return (
    <div
      className={cn(
        'rounded-xl border mb-2 overflow-hidden transition-all duration-300 cursor-pointer select-none',
        rankStyles.border,
        rankStyles.glow,
        isExpanded ? rankStyles.bg || 'bg-slate-800/60' : 'bg-slate-900/60 hover:bg-slate-800/60',
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      aria-expanded={isExpanded}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Rank */}
        <div className="w-8 shrink-0 text-center">
          {entry.rank <= 3 ? (
            <span className="text-lg" aria-hidden="true">
              {RANK_MEDAL[entry.rank]}
            </span>
          ) : (
            <span className={cn('text-sm font-black', rankStyles.text)}>
              {entry.rank}
            </span>
          )}
        </div>

        {/* Trend */}
        <div className="w-4 shrink-0 flex items-center justify-center">
          <TrendArrow direction={trend} />
        </div>

        {/* Avatar + Name */}
        <Avatar
          src={entry.user?.avatar_url}
          name={entry.user?.display_name ?? member?.team_name}
          size="sm"
          teamColor={entry.rank === 1 ? 'ring-yellow-400' : undefined}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">
            {member?.team_name ?? entry.user?.display_name ?? '—'}
          </p>
          <p className="text-[10px] text-slate-500 truncate">
            {entry.user?.display_name}
          </p>
        </div>

        {/* Last match */}
        <div className="hidden sm:flex flex-col items-end shrink-0 w-20">
          <p className="text-[10px] text-slate-600 uppercase tracking-wide">Last Match</p>
          <p
            className={cn(
              'text-sm font-bold',
              entry.last_match_points > 0
                ? 'text-emerald-400'
                : entry.last_match_points < 0
                ? 'text-red-400'
                : 'text-slate-500',
            )}
          >
            {lastMatchDisplay}
          </p>
        </div>

        {/* Total points */}
        <div className="flex flex-col items-end shrink-0 w-24">
          <p className="text-[10px] text-slate-600 uppercase tracking-wide">Total</p>
          <p className={cn('text-lg font-black', rankStyles.text)}>
            {entry.total_points.toLocaleString()}
          </p>
        </div>

        {/* Expand chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            'text-slate-600 shrink-0 transition-transform duration-200',
            isExpanded && 'rotate-180',
          )}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {/* Expanded matchday breakdown */}
      {isExpanded && (
        <div className="border-t border-white/10 px-4 py-3 bg-slate-800/30">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
            Season Breakdown
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500">Total Points</span>
              <span className="font-black text-white">
                {entry.total_points.toLocaleString()}
              </span>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500">Last Match</span>
              <span
                className={cn(
                  'font-black',
                  entry.last_match_points > 0 ? 'text-emerald-400' : 'text-slate-400',
                )}
              >
                {lastMatchDisplay}
              </span>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500">Rank</span>
              <span className="font-black text-white">
                {ordinalSuffix(entry.rank)}
              </span>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500">Last Updated</span>
              <span className="font-medium text-slate-400 text-xs">
                {new Date(entry.updated_at).toLocaleString(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Extended member type used internally
interface MemberWithUser extends RoomMember {}

// ── Leaderboard Component ─────────────────────────────────────────────────────

export function Leaderboard({
  entries,
  members,
  onRowClick,
  expandedUserId: controlledExpanded,
}: LeaderboardProps) {
  const [internalExpanded, setInternalExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'total' | 'last'>('total');
  // Track previous ranks for trend arrows
  const prevRanksRef = useRef<Record<string, number>>({});

  useEffect(() => {
    // On next render cycle, snapshot current ranks as "previous"
    const snapshot: Record<string, number> = {};
    entries.forEach((e) => { snapshot[e.user_id] = e.rank; });
    const timer = setTimeout(() => {
      prevRanksRef.current = snapshot;
    }, 500);
    return () => clearTimeout(timer);
  }, [entries]);

  const expandedUserId = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const membersWithUser = members as MemberWithUser[];

  const sorted = [...entries].sort((a, b) => {
    if (sortBy === 'last') return b.last_match_points - a.last_match_points;
    return b.total_points - a.total_points;
  });

  function handleRowClick(userId: string) {
    if (controlledExpanded === undefined) {
      setInternalExpanded((prev) => (prev === userId ? null : userId));
    }
    onRowClick?.(userId);
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 flex flex-col items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-700"
          aria-hidden="true"
        >
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
        <p className="text-slate-500 font-semibold">No entries yet</p>
        <p className="text-slate-600 text-sm">
          The leaderboard will appear once matches have been played.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Podium ── */}
      <Podium entries={sorted} members={membersWithUser} />

      {/* ── Sort controls ── */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-slate-500 uppercase tracking-wide mr-1">Sort:</span>
        <button
          onClick={() => setSortBy('total')}
          className={cn(
            'text-xs px-3 py-1 rounded-full border transition-all',
            sortBy === 'total'
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
              : 'border-white/10 text-slate-500 hover:text-slate-300',
          )}
        >
          Total Points
        </button>
        <button
          onClick={() => setSortBy('last')}
          className={cn(
            'text-xs px-3 py-1 rounded-full border transition-all',
            sortBy === 'last'
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
              : 'border-white/10 text-slate-500 hover:text-slate-300',
          )}
        >
          Last Match
        </button>
      </div>

      {/* ── Table header (desktop) ── */}
      <div className="hidden sm:grid grid-cols-[2rem_1rem_2.5rem_1fr_5rem_6rem_1rem] gap-3 items-center px-4 py-2 mb-1">
        <span className="text-[10px] text-slate-600 uppercase tracking-wide text-center">#</span>
        <span />
        <span />
        <span className="text-[10px] text-slate-600 uppercase tracking-wide">Team</span>
        <span className="text-[10px] text-slate-600 uppercase tracking-wide text-right">Last</span>
        <span className="text-[10px] text-slate-600 uppercase tracking-wide text-right">Total</span>
        <span />
      </div>

      {/* ── Rows ── */}
      <div>
        {sorted.map((entry) => {
          const member = membersWithUser.find((m) => m.user_id === entry.user_id);
          return (
            <LeaderboardRow
              key={entry.user_id}
              entry={entry}
              member={member}
              isExpanded={expandedUserId === entry.user_id}
              onClick={() => handleRowClick(entry.user_id)}
              previousRanks={prevRanksRef.current}
            />
          );
        })}
      </div>
    </div>
  );
}

export default Leaderboard;
