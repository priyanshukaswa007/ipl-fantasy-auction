'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600',
    'text-navy-900 font-bold text-shadow-sm',
    'border border-yellow-300/40',
    'hover:from-yellow-300 hover:via-amber-400 hover:to-yellow-500',
    'active:from-yellow-500 active:to-yellow-700',
    'shadow-lg shadow-amber-500/30',
    'disabled:from-yellow-800 disabled:via-yellow-700 disabled:to-yellow-800 disabled:text-yellow-500/50 disabled:shadow-none',
  ].join(' '),

  secondary: [
    'bg-transparent',
    'text-purple-300 font-semibold',
    'border-2 border-purple-500',
    'hover:bg-purple-500/20 hover:text-purple-100 hover:border-purple-400',
    'active:bg-purple-500/30',
    'shadow-md shadow-purple-500/20',
    'disabled:border-purple-900 disabled:text-purple-700 disabled:shadow-none',
  ].join(' '),

  danger: [
    'bg-gradient-to-r from-red-600 to-red-700',
    'text-white font-semibold',
    'border border-red-500/40',
    'hover:from-red-500 hover:to-red-600',
    'active:from-red-700 active:to-red-800',
    'shadow-lg shadow-red-700/30',
    'disabled:from-red-900 disabled:to-red-900 disabled:text-red-500/50 disabled:shadow-none',
  ].join(' '),

  ghost: [
    'bg-transparent',
    'text-slate-300 font-medium',
    'border border-transparent',
    'hover:bg-white/10 hover:text-white',
    'active:bg-white/20',
    'disabled:text-slate-600',
  ].join(' '),
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-lg gap-2',
  lg: 'px-7 py-3.5 text-base rounded-xl gap-2.5',
};

const Spinner = ({ size }: { size: ButtonSize }) => {
  const dim = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <svg
      className={cn(dim, 'animate-spin shrink-0')}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        className={cn(
          'inline-flex items-center justify-center',
          'transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
          'cursor-pointer disabled:cursor-not-allowed select-none',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && <Spinner size={size} />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button };
export default Button;
