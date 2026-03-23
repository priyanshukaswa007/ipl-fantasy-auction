'use client';

import { useEffect, useCallback, ReactNode, MouseEvent } from 'react';
import { cn } from '@/lib/utils';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleEscape);
    // Prevent background scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = prev;
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
      onClick={handleBackdropClick}
      className={cn(
        'fixed inset-0 z-50',
        'flex items-end sm:items-center justify-center',
        'p-4 sm:p-6',
        'bg-black/70 backdrop-blur-sm',
        // Fade-in backdrop
        'animate-[fadeIn_150ms_ease-out]',
      )}
      style={{
        // Inline keyframe fallback via CSS variable if Tailwind arbitrary animation isn't compiled
        animationName: 'modalBackdropIn',
      }}
    >
      <style>{`
        @keyframes modalBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative w-full',
          sizeClasses[size],
          'rounded-2xl',
          'bg-slate-900 border border-white/10',
          'shadow-2xl shadow-black/60',
          // Slide-up animation
          '[animation:modalSlideUp_200ms_ease-out]',
          className,
        )}
        style={{ animationName: 'modalSlideUp', animationDuration: '200ms', animationFillMode: 'both' }}
      >
        {/* Header */}
        {title != null && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className={cn(
                'p-1.5 rounded-lg text-slate-400',
                'hover:text-white hover:bg-white/10',
                'transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70',
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
