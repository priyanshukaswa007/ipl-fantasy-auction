'use client';

import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-700/80 text-slate-300 border-slate-600/50',
  success: 'bg-emerald-900/60 text-emerald-300 border-emerald-600/40',
  warning: 'bg-amber-900/60 text-amber-300 border-amber-600/40',
  danger:  'bg-red-900/60   text-red-300   border-red-600/40',
  info:    'bg-blue-900/60  text-blue-300  border-blue-600/40',
};

export function Badge({
  variant = 'default',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        'px-2 py-0.5',
        'text-xs font-semibold uppercase tracking-wide',
        'rounded-full border',
        'whitespace-nowrap',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
