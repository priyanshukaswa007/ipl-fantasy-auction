'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { PlayerCard } from '@/components/PlayerCard';
import { Badge } from '@/components/ui/Badge';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import { AuctionEngine } from '@/lib/auction-engine';
import type { AuctionPick, Player, PlayerRole, RoomSettings } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SquadViewProps {
  picks: AuctionPick[];
  budget: number;
  budgetSpent: number;
  settings: RoomSettings;
  /** Whether to show individual PlayerCard components (larger view) vs compact rows */
  compact?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_ORDER: PlayerRole[] = [
  'Wicketkeeper',
  'Batter',
  'All-Rounder',
  'Bowler',
];

const ROLE_LABELS: Record<PlayerRole, string> = {
  Wicketkeeper: 'Wicketkeepers',
  Batter: 'Batters',
  'All-Rounder': 'All-Rounders',
  Bowler: 'Bowlers',
};

const ROLE_COLORS: Record<PlayerRole, { badge: string; dot: string }> = {
  Wicketkeeper: { badge: 'bg-amber-900/50 text-amber-300 border-amber-500/30', dot: 'bg-amber-400' },
  Batter: { badge: 'bg-blue-900/50 text-blue-300 border-blue-500/30', dot: 'bg-blue-400' },
  'All-Rounder': { badge: 'bg-purple-900/50 text-purple-300 border-purple-500/30', dot: 'bg-purple-400' },
  Bowler: { badge: 'bg-red-900/50 text-red-300 border-red-500/30', dot: 'bg-red-400' },
};

// ── Compact Player Row ────────────────────────────────────────────────────────

function CompactPlayerRow({
  player,
  bidAmount,
}: {
  player: Player;
  bidAmount: number;
}) {
  const isOverseas =
    !['indian', 'india'].includes(
      (player.nationality ?? player.country ?? '').toLowerCase(),
    );

  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-800/50 border border-white/8 px-3 py-2.5 hover:bg-slate-800/80 transition-colors">
      {/* Photo */}
      <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center shrink-0 border-2 border-slate-600">
        {player.photo_url ? (
          <Image
            src={player.photo_url}
            alt={player.name}
            width={40}
            height={40}
            className="object-cover object-top w-full h-full"
          />
        ) : (
          <span className="text-xs font-black text-white">
            {getInitials(player.name)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-sm font-bold text-white truncate">{player.name}</p>
          {isOverseas && (
            <span className="text-[9px] font-bold uppercase tracking-wide text-amber-300 border border-amber-500/40 rounded px-1 py-0.5 shrink-0">
              OS
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">
          {player.team} &middot; {player.nationality ?? player.country}
        </p>
      </div>

      {/* Price */}
      <div className="text-right shrink-0">
        <p className="text-[10px] text-slate-600 uppercase tracking-wide">Paid</p>
        <p className="text-sm font-extrabold text-amber-400">
          {formatCurrency(bidAmount)}
        </p>
      </div>
    </div>
  );
}

// ── Composition Status ────────────────────────────────────────────────────────

function CompositionStatus({
  composition,
  settings,
  totalPlayers,
}: {
  composition: ReturnType<typeof AuctionEngine.calculateSquadComposition>;
  settings: RoomSettings;
  totalPlayers: number;
}) {
  const rules = settings.composition_rules;
  if (!rules.enabled) return null;

  const checks = [
    {
      label: `Min ${rules.min_wicketkeepers} Wicketkeepers`,
      pass: composition.wicketkeepers >= rules.min_wicketkeepers,
      current: composition.wicketkeepers,
      required: rules.min_wicketkeepers,
    },
    {
      label: `Min ${rules.min_batters} Batters`,
      pass: composition.batters >= rules.min_batters,
      current: composition.batters,
      required: rules.min_batters,
    },
    {
      label: `Min ${rules.min_allrounders} All-Rounders`,
      pass: composition.allrounders >= rules.min_allrounders,
      current: composition.allrounders,
      required: rules.min_allrounders,
    },
    {
      label: `Min ${rules.min_bowlers} Bowlers`,
      pass: composition.bowlers >= rules.min_bowlers,
      current: composition.bowlers,
      required: rules.min_bowlers,
    },
    {
      label: `Max ${rules.max_overseas} Overseas`,
      pass: composition.overseas <= rules.max_overseas,
      current: composition.overseas,
      required: rules.max_overseas,
      isMax: true,
    },
    {
      label: `Min ${settings.squad_size_min} Players`,
      pass: totalPlayers >= settings.squad_size_min,
      current: totalPlayers,
      required: settings.squad_size_min,
    },
  ];

  return (
    <div className="rounded-xl bg-slate-800/40 border border-white/10 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
        Squad Rules
      </p>
      <div className="grid grid-cols-2 gap-2">
        {checks.map((c) => (
          <div
            key={c.label}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-xs border',
              c.pass
                ? 'bg-emerald-900/30 border-emerald-600/30 text-emerald-300'
                : 'bg-red-900/20 border-red-600/20 text-red-400',
            )}
          >
            <span className="text-base leading-none" aria-hidden="true">
              {c.pass ? '✓' : '✗'}
            </span>
            <span className="flex-1">{c.label}</span>
            <span className={cn('font-bold tabular-nums', c.pass ? 'text-emerald-400' : 'text-red-300')}>
              {c.current}
              {c.isMax ? `/${c.required}` : `/${c.required}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SquadView ─────────────────────────────────────────────────────────────────

export function SquadView({
  picks,
  budget,
  budgetSpent,
  settings,
  compact = false,
}: SquadViewProps) {
  const players: Player[] = picks.map((p) => p.player).filter(Boolean) as Player[];

  const composition = useMemo(
    () => AuctionEngine.calculateSquadComposition(players),
    [players],
  );

  const byRole = useMemo(() => {
    const map: Record<PlayerRole, Array<{ player: Player; pick: AuctionPick }>> = {
      Wicketkeeper: [],
      Batter: [],
      'All-Rounder': [],
      Bowler: [],
    };
    picks.forEach((pick) => {
      const player = pick.player as Player | undefined;
      if (!player) return;
      map[player.role].push({ player, pick });
    });
    return map;
  }, [picks]);

  const budgetRemaining = budget - budgetSpent;
  const totalSquadValue = picks.reduce((sum, p) => sum + (p.bid_amount ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-800/60 border border-white/10 px-4 py-3 flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
            Total Players
          </span>
          <span className="text-2xl font-black text-white">{players.length}</span>
          <span className="text-[10px] text-slate-600 mt-0.5">
            of {settings.squad_size_max} max
          </span>
        </div>
        <div className="rounded-xl bg-slate-800/60 border border-white/10 px-4 py-3 flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
            Budget Spent
          </span>
          <span className="text-2xl font-black text-amber-400">
            {formatCurrency(budgetSpent)}
          </span>
          <span className="text-[10px] text-slate-600 mt-0.5">
            of {formatCurrency(budget)}
          </span>
        </div>
        <div className="rounded-xl bg-slate-800/60 border border-white/10 px-4 py-3 flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
            Budget Left
          </span>
          <span
            className={cn(
              'text-2xl font-black',
              budgetRemaining < budget * 0.1
                ? 'text-red-400'
                : budgetRemaining < budget * 0.3
                ? 'text-amber-400'
                : 'text-emerald-400',
            )}
          >
            {formatCurrency(budgetRemaining)}
          </span>
          <span className="text-[10px] text-slate-600 mt-0.5">remaining</span>
        </div>
        <div className="rounded-xl bg-slate-800/60 border border-white/10 px-4 py-3 flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
            Overseas
          </span>
          <span
            className={cn(
              'text-2xl font-black',
              composition.overseas > settings.composition_rules.max_overseas
                ? 'text-red-400'
                : 'text-white',
            )}
          >
            {composition.overseas}
          </span>
          <span className="text-[10px] text-slate-600 mt-0.5">
            of {settings.composition_rules.max_overseas} max
          </span>
        </div>
      </div>

      {/* ── Composition breakdown pills ── */}
      <div className="flex flex-wrap gap-2">
        {ROLE_ORDER.map((role) => {
          const count = byRole[role].length;
          const colors = ROLE_COLORS[role];
          return (
            <div
              key={role}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border',
                colors.badge,
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', colors.dot)} />
              {count} {ROLE_LABELS[role]}
            </div>
          );
        })}
      </div>

      {/* ── Composition Status ── */}
      <CompositionStatus
        composition={composition}
        settings={settings}
        totalPlayers={players.length}
      />

      {/* ── Players by Role ── */}
      {players.length === 0 ? (
        <div className="text-center py-12 text-slate-600 text-sm">
          No players in squad yet.
        </div>
      ) : (
        ROLE_ORDER.map((role) => {
          const rolePicks = byRole[role];
          if (rolePicks.length === 0) return null;
          const colors = ROLE_COLORS[role];

          return (
            <div key={role}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn('h-2.5 w-2.5 rounded-full', colors.dot)} />
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                  {ROLE_LABELS[role]}
                </h3>
                <span className="text-xs text-slate-600">
                  ({rolePicks.length})
                </span>
              </div>

              {compact ? (
                <div className="flex flex-col gap-2">
                  {rolePicks.map(({ player, pick }) => (
                    <CompactPlayerRow
                      key={pick.id}
                      player={player}
                      bidAmount={pick.bid_amount}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {rolePicks.map(({ player, pick }) => (
                    <PlayerCard
                      key={pick.id}
                      player={player}
                      size="sm"
                      bidAmount={pick.bid_amount}
                      isSold
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ── Total Squad Value ── */}
      {players.length > 0 && (
        <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-400">Total Squad Value</span>
          <span className="text-lg font-black text-amber-400">
            {formatCurrency(totalSquadValue)}
          </span>
        </div>
      )}
    </div>
  );
}

export default SquadView;
