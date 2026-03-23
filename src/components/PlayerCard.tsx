'use client';

import Image from 'next/image';
import { Player, TEAM_COLORS, TEAM_FULL_NAMES } from '@/types';
import { cn, formatCurrency, getInitials, getRatingColor, getRatingLabel } from '@/lib/utils';

// ─── Rating ring colour (border) ─────────────────────────────────────────────
function getRatingBorderColor(rating: number): string {
  if (rating >= 85) return '#34d399'; // emerald-400
  if (rating >= 70) return '#60a5fa'; // blue-400
  if (rating >= 55) return '#facc15'; // yellow-400
  if (rating >= 40) return '#fb923c'; // orange-400
  return '#f87171';                    // red-400
}

// ─── Role badge colours ───────────────────────────────────────────────────────
function getRoleBadgeStyle(role: Player['role']): string {
  switch (role) {
    case 'Batter':       return 'bg-blue-900/70   text-blue-200   border-blue-500/40';
    case 'Bowler':       return 'bg-red-900/70    text-red-200    border-red-500/40';
    case 'All-Rounder':  return 'bg-purple-900/70 text-purple-200 border-purple-500/40';
    case 'Wicketkeeper': return 'bg-amber-900/70  text-amber-200  border-amber-500/40';
    default:             return 'bg-slate-800/70  text-slate-300  border-slate-500/40';
  }
}

// ─── Size config ──────────────────────────────────────────────────────────────
const sizeConfig = {
  sm: { card: 'w-44',  photo: 64,  nameText: 'text-sm',  subText: 'text-xs', ratingSize: 36 },
  md: { card: 'w-56',  photo: 80,  nameText: 'text-base', subText: 'text-xs', ratingSize: 44 },
  lg: { card: 'w-72',  photo: 100, nameText: 'text-lg',  subText: 'text-sm', ratingSize: 54 },
} as const;

// ─── Stat cell ────────────────────────────────────────────────────────────────
function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-white/90 font-bold text-sm leading-none">{value}</span>
      <span className="text-slate-500 text-[10px] uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface PlayerCardProps {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showStats?: boolean;
  bidAmount?: number;
  isSold?: boolean;
  soldTo?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function PlayerCard({
  player,
  size = 'md',
  onClick,
  showStats = false,
  bidAmount,
  isSold = false,
  soldTo,
}: PlayerCardProps) {
  const colors = TEAM_COLORS[player.team];
  const cfg   = sizeConfig[size];
  const isOverseas = player.nationality?.toLowerCase() !== 'indian' &&
                     player.country?.toLowerCase() !== 'india';

  const ratingBorder = getRatingBorderColor(player.rating);
  const ratingTextClass = getRatingColor(player.rating);
  const ratingLabel = getRatingLabel(player.rating);

  const stats = player.career_stats;

  // Format bowling avg — avoid division by zero / invalid values
  const bowlingAvg = stats.bowling_avg > 0 ? stats.bowling_avg.toFixed(1) : '–';
  const battingAvg = stats.batting_avg > 0 ? stats.batting_avg.toFixed(1) : '–';
  const strikerate = stats.batting_sr  > 0 ? stats.batting_sr.toFixed(1)  : '–';
  const economy    = stats.economy     > 0 ? stats.economy.toFixed(2)      : '–';

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      onClick={onClick}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl',
        'border border-white/10',
        'bg-[#0f172a] shadow-xl',
        'transition-all duration-300',
        cfg.card,
        onClick && [
          'cursor-pointer',
          'hover:scale-[1.03]',
          'hover:border-white/20',
        ],
        // Team-color glow on hover
        onClick && 'hover:shadow-[0_0_28px_4px_var(--team-glow)]',
      )}
      style={{
        // Expose team glow colour for the CSS var above
        ['--team-glow' as string]: `${colors.primary}55`,
      }}
    >
      {/* ── Team colour gradient header strip ─── */}
      <div
        className="relative h-14 w-full shrink-0 flex items-end pb-1 px-3 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
        }}
      >
        {/* Subtle mesh overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
            backgroundSize: '8px 8px',
          }}
        />
        {/* Team abbreviation */}
        <span className="relative z-10 font-black text-white/90 text-xs tracking-widest drop-shadow">
          {player.team}
        </span>
        {/* Overseas badge */}
        {isOverseas && (
          <span className="relative z-10 ml-auto text-[9px] font-bold tracking-widest uppercase bg-black/40 text-amber-300 border border-amber-400/50 rounded px-1.5 py-0.5">
            OVERSEAS
          </span>
        )}
      </div>

      {/* ── Photo + Rating row ─── */}
      <div className="relative flex items-end justify-between px-3 -mt-8 z-10">
        {/* Circular photo */}
        <div
          className="rounded-full overflow-hidden shrink-0 flex items-center justify-center shadow-lg"
          style={{
            width:  cfg.photo,
            height: cfg.photo,
            border: `3px solid ${colors.primary}`,
            background: player.photo_url ? undefined : colors.primary,
          }}
        >
          {player.photo_url ? (
            <Image
              src={player.photo_url}
              alt={player.name}
              width={cfg.photo}
              height={cfg.photo}
              className="object-cover object-top w-full h-full"
            />
          ) : (
            <span
              className="font-black text-white select-none"
              style={{ fontSize: cfg.photo * 0.32 }}
            >
              {getInitials(player.name)}
            </span>
          )}
        </div>

        {/* Rating circle */}
        <div
          className="flex flex-col items-center justify-center rounded-full bg-slate-900 shadow-md shrink-0"
          style={{
            width:  cfg.ratingSize,
            height: cfg.ratingSize,
            border: `2.5px solid ${ratingBorder}`,
          }}
        >
          <span className={cn('font-black leading-none', ratingTextClass, size === 'sm' ? 'text-xs' : 'text-sm')}>
            {player.rating}
          </span>
          {size !== 'sm' && (
            <span className="text-[8px] text-slate-500 uppercase tracking-wide leading-none mt-0.5">
              {ratingLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── Player info ─── */}
      <div className="px-3 pt-1.5 pb-2 flex flex-col gap-0.5">
        {/* Name */}
        <h3 className={cn('font-extrabold text-white leading-tight truncate', cfg.nameText)}>
          {player.name}
        </h3>

        {/* Team full name */}
        <p className={cn('text-slate-400 truncate leading-tight', cfg.subText)}>
          {TEAM_FULL_NAMES[player.team]}
        </p>

        {/* Role + batting/bowling styles row */}
        <div className="flex flex-wrap items-center gap-1 mt-1">
          <span
            className={cn(
              'text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border',
              getRoleBadgeStyle(player.role),
            )}
          >
            {player.role}
          </span>
        </div>

        {/* Batting / bowling style */}
        <div className={cn('flex flex-col gap-0', cfg.subText, 'text-slate-500 mt-1')}>
          {player.batting_style && (
            <span className="truncate">
              <span className="text-slate-600">BAT</span> {player.batting_style}
            </span>
          )}
          {player.bowling_style && player.bowling_style !== '–' && (
            <span className="truncate">
              <span className="text-slate-600">BWL</span> {player.bowling_style}
            </span>
          )}
        </div>
      </div>

      {/* ── Price row ─── */}
      <div
        className="mx-3 mb-2 rounded-xl px-3 py-2 flex items-center justify-between gap-2"
        style={{ background: `${colors.primary}18`, border: `1px solid ${colors.primary}30` }}
      >
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-500 uppercase tracking-wider">Base</span>
          <span className="text-xs font-bold text-slate-300">{formatCurrency(player.base_price)}</span>
        </div>
        <div className="w-px h-6 bg-white/10" />
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-slate-500 uppercase tracking-wider">IPL Price</span>
          <span
            className="text-xs font-extrabold"
            style={{ color: colors.primary }}
          >
            {formatCurrency(player.ipl_price)}
          </span>
        </div>
      </div>

      {/* ── Career stats grid (optional) ─── */}
      {showStats && stats && (
        <div className="mx-3 mb-3 rounded-xl bg-white/5 border border-white/8 px-2 py-2 grid grid-cols-3 gap-y-2">
          <StatCell label="M"   value={stats.matches} />
          <StatCell label="Runs" value={stats.runs > 0 ? stats.runs.toLocaleString() : '–'} />
          <StatCell label="Wkts" value={stats.wickets > 0 ? stats.wickets : '–'} />
          <StatCell label="SR"   value={strikerate} />
          <StatCell label="Avg"  value={battingAvg} />
          <StatCell label="Eco"  value={economy} />
        </div>
      )}

      {/* ── Live bid overlay ─── */}
      {bidAmount !== undefined && !isSold && (
        <div
          className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between"
          style={{
            background: `linear-gradient(to top, ${colors.primary}ee, ${colors.primary}88)`,
          }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">
            Current Bid
          </span>
          <span className="font-black text-white text-base animate-bid-pop">
            {formatCurrency(bidAmount)}
          </span>
        </div>
      )}

      {/* ── SOLD stamp overlay ─── */}
      {isSold && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] rounded-2xl z-20">
          <div className="animate-sold-stamp flex flex-col items-center gap-1">
            <span
              className="text-4xl font-black tracking-widest text-red-500 border-4 border-red-500 rounded-lg px-3 py-0.5 drop-shadow-lg"
              style={{ textShadow: '0 0 20px rgba(239,68,68,0.8)' }}
            >
              SOLD
            </span>
            {soldTo && (
              <span className="text-xs font-bold text-white/90 bg-black/50 rounded px-2 py-0.5 mt-1 max-w-[90%] truncate text-center">
                {soldTo}
              </span>
            )}
            {bidAmount !== undefined && (
              <span
                className="text-sm font-extrabold mt-0.5"
                style={{ color: colors.primary }}
              >
                {formatCurrency(bidAmount)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerCard;
