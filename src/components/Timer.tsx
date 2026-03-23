'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface TimerProps {
  seconds: number;
  isActive: boolean;
  onComplete: () => void;
  warningAt?: number;
  totalSeconds?: number;
  className?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function Timer({
  seconds,
  isActive,
  onComplete,
  warningAt = 5,
  totalSeconds,
  className,
}: TimerProps) {
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const prevSecondsRef = useRef(seconds);
  const firedRef = useRef(false);

  // Track when we cross zero
  useEffect(() => {
    if (seconds <= 0 && prevSecondsRef.current > 0 && !firedRef.current && isActive) {
      firedRef.current = true;
      onCompleteRef.current();
    }
    if (seconds > 0) firedRef.current = false;
    prevSecondsRef.current = seconds;
  }, [seconds, isActive]);

  // ── Derived style state ─────────────────────────────────────────────────────
  const isDanger  = seconds <= warningAt && seconds > 0;
  const isWarning = seconds <= 10 && seconds > warningAt;
  const isGreen   = !isWarning && !isDanger;

  // Phrase overlay
  let phrase = '';
  if (seconds <= 3 && seconds > 0) phrase = 'Going twice...';
  else if (seconds <= 5 && seconds > 3) phrase = 'Going once...';

  // ── SVG ring math ───────────────────────────────────────────────────────────
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const maxSecs = totalSeconds ?? Math.max(seconds, 15);
  const progress = Math.max(0, Math.min(1, seconds / maxSecs));
  const dashOffset = circumference * (1 - progress);

  // Color tokens
  const ringColor = isDanger
    ? '#ef4444'   // red-500
    : isWarning
      ? '#eab308' // yellow-500
      : '#22c55e'; // green-500

  const glowColor = isDanger
    ? 'rgba(239,68,68,0.5)'
    : isWarning
      ? 'rgba(234,179,8,0.4)'
      : 'rgba(34,197,94,0.3)';

  const textColor = isDanger
    ? 'text-red-400'
    : isWarning
      ? 'text-yellow-400'
      : 'text-emerald-400';

  return (
    <div
      className={cn('flex flex-col items-center gap-2 select-none', className)}
      aria-label={`Timer: ${seconds} seconds remaining`}
    >
      {/* ── Circular SVG ring ─── */}
      <div
        className={cn(
          'relative flex items-center justify-center',
          isDanger && isActive && 'animate-[shake_0.4s_ease-in-out_infinite]',
        )}
        style={{
          filter: isActive ? `drop-shadow(0 0 12px ${glowColor})` : 'none',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{
              transition: isActive ? 'stroke-dashoffset 1s linear, stroke 0.3s ease' : 'none',
            }}
          />
        </svg>

        {/* Center seconds display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'font-black leading-none tabular-nums',
              seconds >= 100 ? 'text-3xl' : 'text-4xl',
              textColor,
              isDanger && isActive && 'animate-[pulse_0.8s_ease-in-out_infinite]',
            )}
          >
            {Math.max(0, seconds)}
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
            {isActive ? 'sec' : 'paused'}
          </span>
        </div>
      </div>

      {/* ── "Going once / twice" phrase ─── */}
      <div className="h-5 flex items-center">
        {phrase && isActive && (
          <p
            className={cn(
              'text-xs font-bold tracking-wide animate-[fadeIn_0.3s_ease-out]',
              isDanger ? 'text-red-400' : 'text-yellow-400',
            )}
          >
            {phrase}
          </p>
        )}
      </div>
    </div>
  );
}

export default Timer;
