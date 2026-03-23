'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils';

export type AvatarSize = 'sm' | 'md' | 'lg';

/** Pass any valid Tailwind border-color class, e.g. 'border-yellow-400' */
export type TeamColor = string;

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
  /** Tailwind border-color class such as 'border-amber-400' or 'border-purple-500' */
  teamColor?: TeamColor;
  className?: string;
  alt?: string;
}

const sizeClasses: Record<AvatarSize, { wrapper: string; text: string; ring: string }> = {
  sm: { wrapper: 'h-8 w-8',   text: 'text-xs',  ring: 'ring-1' },
  md: { wrapper: 'h-10 w-10', text: 'text-sm',  ring: 'ring-2' },
  lg: { wrapper: 'h-16 w-16', text: 'text-xl',  ring: 'ring-2' },
};

/** Stable color bucket for initials-only avatars based on first char */
const PALETTE = [
  'from-purple-600 to-indigo-700',
  'from-amber-500 to-yellow-600',
  'from-rose-600 to-pink-700',
  'from-teal-500 to-cyan-600',
  'from-blue-600 to-violet-700',
  'from-emerald-500 to-green-600',
  'from-orange-500 to-red-600',
];

function getBgGradient(name?: string): string {
  if (!name) return PALETTE[0];
  const idx = name.charCodeAt(0) % PALETTE.length;
  return PALETTE[idx];
}

export function Avatar({
  src,
  name,
  size = 'md',
  teamColor,
  className,
  alt,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const { wrapper, text, ring } = sizeClasses[size];
  const initials = name ? getInitials(name) : '?';
  const gradient = getBgGradient(name);
  const showImage = src && !imgError;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center',
        'rounded-full overflow-hidden',
        'select-none',
        wrapper,
        // Team color ring
        teamColor
          ? cn(ring, 'ring-offset-1 ring-offset-slate-900', teamColor)
          : cn('ring-1 ring-white/10'),
        className,
      )}
      title={name}
      aria-label={alt ?? name ?? 'Avatar'}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt ?? name ?? 'Avatar'}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
          draggable={false}
        />
      ) : (
        <span
          className={cn(
            'flex h-full w-full items-center justify-center',
            'bg-gradient-to-br font-bold tracking-wide text-white',
            gradient,
            text,
          )}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
    </span>
  );
}

export default Avatar;
