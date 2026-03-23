'use client';

import { forwardRef, InputHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className, disabled, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'text-sm font-medium',
              disabled ? 'text-slate-600' : 'text-slate-300',
            )}
          >
            {label}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            [error ? errorId : null, hint ? hintId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={cn(
            'w-full rounded-lg px-4 py-2.5 text-sm',
            'bg-slate-800/80 text-white placeholder:text-slate-500',
            'border transition-colors duration-150 outline-none',
            // Normal state
            !error && 'border-slate-700 hover:border-slate-600',
            // Focus state
            !error &&
              'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20',
            // Error state
            error &&
              'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20',
            // Disabled
            disabled && 'opacity-50 cursor-not-allowed bg-slate-900/60',
            className,
          )}
          {...props}
        />

        {hint && !error && (
          <p id={hintId} className="text-xs text-slate-500">
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" className="text-xs text-red-400 flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="shrink-0"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input };
export default Input;
