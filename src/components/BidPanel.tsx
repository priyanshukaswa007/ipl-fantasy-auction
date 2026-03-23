'use client';

import { useRef, useState, useCallback } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { Timer } from '@/components/Timer';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface BidPanelProps {
  currentBid: number;
  bidIncrement: number;
  onBid: (customAmount?: number) => Promise<void>;
  canBid: boolean;
  bidReason?: string;
  timeRemaining: number;
  timerActive: boolean;
  currentBidder?: string | null;
  totalTimerSeconds?: number;
  onTimerComplete?: () => void;
  className?: string;
}

// ── Quick-increment amounts ───────────────────────────────────────────────────

const QUICK_INCREMENTS = [0.25, 0.5, 1.0] as const;

// ── Component ──────────────────────────────────────────────────────────────────

export function BidPanel({
  currentBid,
  bidIncrement,
  onBid,
  canBid,
  bidReason,
  timeRemaining,
  timerActive,
  currentBidder,
  totalTimerSeconds,
  onTimerComplete,
  className,
}: BidPanelProps) {
  const [pressing, setPressing] = useState(false);
  const lastBidRef = useRef(0);

  // Throttled bid handler — max once per 2 seconds
  const handleBid = useCallback(async (customAmount?: number) => {
    const now = Date.now();
    if (!canBid || now - lastBidRef.current < 2000) return;
    lastBidRef.current = now;

    setPressing(true);
    try {
      await onBid(customAmount);
    } finally {
      // Brief visual bounce then release
      setTimeout(() => setPressing(false), 300);
    }
  }, [canBid, onBid]);

  const nextBid = currentBid + bidIncrement;

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* ── Timer ─── */}
      <Timer
        seconds={timeRemaining}
        isActive={timerActive}
        onComplete={onTimerComplete ?? (() => {})}
        warningAt={5}
        totalSeconds={totalTimerSeconds}
      />

      {/* ── Current bid display ─── */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs text-slate-500 uppercase tracking-widest">
          Current Bid
        </span>
        <span
          className={cn(
            'text-4xl font-black text-white tabular-nums',
            'transition-all duration-300',
          )}
          key={currentBid} // triggers re-mount animation on change
        >
          {currentBid > 0 ? formatCurrency(currentBid) : '—'}
        </span>
        {currentBidder && (
          <span className="text-xs text-amber-400 font-semibold mt-0.5">
            by {currentBidder}
          </span>
        )}
      </div>

      {/* ── Main BID button ─── */}
      <div className="relative w-full max-w-xs group">
        <button
          onClick={() => handleBid()}
          disabled={!canBid}
          aria-label={`Place bid of ${formatCurrency(nextBid)}`}
          title={!canBid ? (bidReason ?? 'Cannot bid right now') : undefined}
          className={cn(
            'w-full relative overflow-hidden',
            'rounded-2xl px-8 py-5',
            'font-black text-2xl tracking-widest uppercase',
            'transition-all duration-200 select-none',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/50',
            canBid
              ? [
                  'bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-500',
                  'text-slate-900',
                  'shadow-[0_0_32px_8px_rgba(245,158,11,0.4)]',
                  'hover:from-yellow-300 hover:via-amber-400 hover:to-yellow-400',
                  'hover:shadow-[0_0_48px_12px_rgba(245,158,11,0.55)]',
                  'active:scale-95',
                  pressing && 'animate-[bid-pop_0.3s_cubic-bezier(0.34,1.56,0.64,1)]',
                ].join(' ')
              : [
                  'bg-slate-800',
                  'text-slate-600',
                  'border border-slate-700',
                  'cursor-not-allowed',
                ].join(' '),
          )}
        >
          {/* Shimmer on enabled */}
          {canBid && (
            <span
              className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
              aria-hidden="true"
            />
          )}
          <span className="relative z-10 flex flex-col items-center leading-none">
            <span>BID</span>
            {canBid && (
              <span className="text-sm font-bold mt-1 opacity-80">
                {formatCurrency(nextBid)}
              </span>
            )}
          </span>
        </button>

        {/* Disabled reason tooltip */}
        {!canBid && bidReason && (
          <p className="mt-2 text-center text-xs text-slate-500 px-2">
            {bidReason}
          </p>
        )}
      </div>

      {/* ── Quick increment buttons ─── */}
      <div className="flex gap-2">
        {QUICK_INCREMENTS.map((inc) => {
          const amt = currentBid + inc;
          const isActive = canBid;
          return (
            <button
              key={inc}
              onClick={isActive ? () => handleBid(amt) : undefined}
              disabled={!isActive}
              aria-label={`Quick bid +${inc} Cr`}
              className={cn(
                'flex flex-col items-center rounded-xl px-3 py-2',
                'text-xs font-bold transition-all duration-200 select-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50',
                isActive
                  ? [
                      'bg-slate-700/80 border border-amber-500/30',
                      'text-amber-400 hover:bg-slate-600 hover:border-amber-400/60',
                      'active:scale-95',
                    ].join(' ')
                  : 'bg-slate-800/40 border border-slate-700/30 text-slate-600 cursor-not-allowed',
              )}
            >
              <span className="text-[10px] text-slate-500 font-normal leading-none mb-0.5">
                +{inc} Cr
              </span>
              <span>{formatCurrency(amt)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default BidPanel;
