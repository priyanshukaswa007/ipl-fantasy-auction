'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import { Player, IPLTeam, PlayerRole, TEAM_FULL_NAMES } from '@/types';
import { PlayerCard } from '@/components/PlayerCard';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────
const IPL_TEAMS: IPLTeam[] = ['CSK', 'MI', 'RCB', 'KKR', 'DC', 'PBKS', 'RR', 'GT', 'LSG', 'SRH'];
const ROLES: PlayerRole[]  = ['Batter', 'Bowler', 'All-Rounder', 'Wicketkeeper'];
const PAGE_SIZE = 24;

type SortOption = 'rating_desc' | 'price_desc' | 'name_asc';
type NationalityFilter = 'all' | 'indian' | 'overseas';

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="w-56 rounded-2xl overflow-hidden bg-slate-900/80 border border-white/10 animate-pulse">
      {/* header strip */}
      <div className="h-14 bg-slate-700/60" />
      {/* photo + rating */}
      <div className="flex items-end justify-between px-3 -mt-8 pb-2">
        <div className="w-20 h-20 rounded-full bg-slate-700/70 border-2 border-slate-600" />
        <div className="w-11 h-11 rounded-full bg-slate-700/70" />
      </div>
      {/* name lines */}
      <div className="px-3 space-y-2 pb-3">
        <div className="h-3.5 bg-slate-700/60 rounded w-3/4" />
        <div className="h-3 bg-slate-700/40 rounded w-1/2" />
        <div className="h-3 bg-slate-700/30 rounded w-2/3 mt-1" />
      </div>
      {/* price */}
      <div className="mx-3 mb-3 h-10 rounded-xl bg-slate-700/30" />
      {/* stats */}
      <div className="mx-3 mb-3 h-16 rounded-xl bg-slate-700/20" />
    </div>
  );
}

// ─── Filter select ────────────────────────────────────────────────────────────
interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  className?: string;
}

function FilterSelect({ value, onChange, options, className }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'rounded-lg px-3 py-2 text-sm font-medium',
        'bg-slate-800/80 text-white border border-slate-700',
        'hover:border-slate-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20',
        'outline-none transition-colors cursor-pointer',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-slate-900">
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────
export default function PlayersPage() {
  const supabase = getSupabaseBrowser();

  // Data state
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Filter state
  const [search, setSearch]           = useState('');
  const [teamFilter, setTeamFilter]   = useState<string>('all');
  const [roleFilter, setRoleFilter]   = useState<string>('all');
  const [natFilter, setNatFilter]     = useState<NationalityFilter>('all');
  const [sortBy, setSortBy]           = useState<SortOption>('rating_desc');

  // Pagination
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 260);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  // Fetch all players once on mount
  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: sbError } = await supabase
        .from('players')
        .select('*')
        .order('rating', { ascending: false });

      if (sbError) throw sbError;
      setPlayers((data as Player[]) ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load players.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearch, teamFilter, roleFilter, natFilter, sortBy]);

  // Derived filtered + sorted list
  const filtered = useMemo(() => {
    let list = [...players];

    // Search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Team
    if (teamFilter !== 'all') {
      list = list.filter((p) => p.team === teamFilter);
    }

    // Role
    if (roleFilter !== 'all') {
      list = list.filter((p) => p.role === roleFilter);
    }

    // Nationality
    if (natFilter !== 'all') {
      list = list.filter((p) => {
        const isIndian =
          p.nationality?.toLowerCase() === 'indian' ||
          p.country?.toLowerCase() === 'india';
        return natFilter === 'indian' ? isIndian : !isIndian;
      });
    }

    // Sort
    switch (sortBy) {
      case 'rating_desc':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'price_desc':
        list.sort((a, b) => b.ipl_price - a.ipl_price);
        break;
      case 'name_asc':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return list;
  }, [players, debouncedSearch, teamFilter, roleFilter, natFilter, sortBy]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // ── Team select options
  const teamOptions = [
    { label: 'All Teams', value: 'all' },
    ...IPL_TEAMS.map((t) => ({ label: `${t} – ${TEAM_FULL_NAMES[t]}`, value: t })),
  ];

  const roleOptions = [
    { label: 'All Roles', value: 'all' },
    ...ROLES.map((r) => ({ label: r, value: r })),
  ];

  const natOptions = [
    { label: 'All Players', value: 'all' },
    { label: 'Indian',   value: 'indian' },
    { label: 'Overseas', value: 'overseas' },
  ];

  const sortOptions: { label: string; value: SortOption }[] = [
    { label: 'Rating (High → Low)', value: 'rating_desc' },
    { label: 'Price (High → Low)',  value: 'price_desc'  },
    { label: 'Name (A → Z)',        value: 'name_asc'    },
  ];

  const clearFilters = () => {
    setSearch('');
    setTeamFilter('all');
    setRoleFilter('all');
    setNatFilter('all');
    setSortBy('rating_desc');
  };

  const hasActiveFilters =
    search || teamFilter !== 'all' || roleFilter !== 'all' || natFilter !== 'all';

  return (
    <div className="min-h-screen gradient-bg">
      {/* ── Page header ─── */}
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400/80 mb-1">
                IPL Fantasy Auction
              </p>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Player <span className="text-gradient">Database</span>
              </h1>
            </div>
            {!loading && (
              <p className="sm:ml-auto text-slate-500 text-sm pb-0.5">
                {filtered.length === players.length
                  ? `${players.length} players`
                  : `${filtered.length} of ${players.length} players`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Controls bar ─── */}
      <div className="sticky top-0 z-30 bg-[#0a0e1a]/90 backdrop-blur-md border-b border-white/10 shadow-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col gap-3">
            {/* Search row */}
            <div className="relative flex-1 max-w-sm">
              {/* Search icon */}
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search players…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full rounded-lg pl-9 pr-4 py-2 text-sm',
                  'bg-slate-800/80 text-white placeholder:text-slate-500',
                  'border border-slate-700 hover:border-slate-500',
                  'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none',
                  'transition-colors',
                )}
              />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                value={teamFilter}
                onChange={setTeamFilter}
                options={teamOptions}
              />
              <FilterSelect
                value={roleFilter}
                onChange={setRoleFilter}
                options={roleOptions}
              />
              <FilterSelect
                value={natFilter}
                onChange={(v) => setNatFilter(v as NationalityFilter)}
                options={natOptions}
              />

              {/* Divider */}
              <div className="hidden sm:block w-px h-6 bg-white/10" />

              <FilterSelect
                value={sortBy}
                onChange={(v) => setSortBy(v as SortOption)}
                options={sortOptions}
                className="min-w-[180px]"
              />

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider',
                    'text-amber-400 border border-amber-400/40 bg-amber-400/10',
                    'hover:bg-amber-400/20 transition-colors',
                  )}
                >
                  Clear
                </button>
              )}

              {/* Result count pill */}
              {!loading && (
                <span className="ml-auto text-xs text-slate-500 font-medium whitespace-nowrap">
                  Showing{' '}
                  <span className="text-white font-bold">{Math.min(visibleCount, filtered.length)}</span>
                  {' / '}
                  <span className="text-white font-bold">{filtered.length}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ─── */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error state */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-900/20 px-5 py-4 flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-300">Failed to load players</p>
              <p className="text-xs text-red-400/80 mt-0.5">{error}</p>
              <button
                onClick={fetchPlayers}
                className="mt-2 text-xs font-bold text-red-300 underline underline-offset-2 hover:text-red-200"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-800/80 flex items-center justify-center border border-white/10">
              <svg
                className="w-9 h-9 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-white">No players found</p>
              <p className="text-sm text-slate-500 mt-1">
                Try adjusting your filters or search term.
              </p>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="btn-primary text-sm px-5 py-2"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Player grid */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
              {visible.map((player) => (
                <div key={player.id} className="animate-slide-up">
                  <PlayerCard
                    player={player}
                    size="md"
                    showStats={true}
                  />
                </div>
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-10 flex flex-col items-center gap-2">
                <p className="text-slate-500 text-sm">
                  Showing {visible.length} of {filtered.length} players
                </p>
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className={cn(
                    'btn-secondary px-8 py-2.5',
                  )}
                >
                  Load More
                </button>
              </div>
            )}

            {/* All-loaded indicator */}
            {!hasMore && filtered.length > PAGE_SIZE && (
              <p className="mt-10 text-center text-slate-600 text-sm">
                All {filtered.length} players loaded
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
