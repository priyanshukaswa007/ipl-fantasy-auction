'use client';

import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type CardGlow = 'gold' | 'purple' | 'none';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: CardGlow;
}

const glowClasses: Record<CardGlow, string> = {
  gold: [
    'border-yellow-500/40',
    'shadow-xl shadow-amber-500/20',
    'hover:shadow-amber-500/30 hover:border-yellow-400/60',
  ].join(' '),
  purple: [
    'border-purple-500/40',
    'shadow-xl shadow-purple-500/20',
    'hover:shadow-purple-500/30 hover:border-purple-400/60',
  ].join(' '),
  none: 'border-white/10 shadow-lg shadow-black/30',
};

export function Card({ glow = 'none', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border',
        'bg-slate-900/80 backdrop-blur-sm',
        'transition-all duration-300',
        glowClasses[glow],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('px-6 py-4 border-b border-white/10', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {}

export function CardBody({ className, children, ...props }: CardBodyProps) {
  return (
    <div className={cn('px-6 py-4', className)} {...props}>
      {children}
    </div>
  );
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cn('px-6 py-4 border-t border-white/10', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
