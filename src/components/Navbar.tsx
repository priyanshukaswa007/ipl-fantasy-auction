'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/Avatar';

// ── Nav links (only shown when authenticated) ─────────────────────────────────

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Players',   href: '/players'   },
  { label: 'Admin',     href: '/admin'      },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function Navbar() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => setMenuOpen((prev) => !prev), []);
  const closeMenu  = useCallback(() => setMenuOpen(false), []);

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/10"
      style={{ background: 'rgba(15, 23, 42, 0.80)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* ── Logo ── */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-xl font-extrabold tracking-tight select-none"
          onClick={closeMenu}
        >
          {/* Cricket ball icon */}
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-base"
                style={{ background: 'linear-gradient(135deg, #F5A623 0%, #FFCA5A 100%)' }}>
            🏏
          </span>
          <span className="text-gradient">IPL Auction</span>
        </Link>

        {/* ── Desktop center nav ── */}
        {user && !loading && (
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="rounded-md px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {label}
              </Link>
            ))}
          </div>
        )}

        {/* ── Desktop right: auth controls ── */}
        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            // Skeleton placeholder to avoid layout shift
            <div className="h-9 w-28 animate-pulse rounded-lg bg-white/10" />
          ) : user ? (
            <>
              {/* User info */}
              <div className="flex items-center gap-2">
                <Avatar
                  src={user.avatar_url}
                  name={user.display_name}
                  size="sm"
                  teamColor="border-amber-400"
                />
                <span className="max-w-[140px] truncate text-sm font-medium text-white/90">
                  {user.display_name}
                </span>
              </div>

              {/* Sign out */}
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="btn-primary text-sm"
            >
              Sign In
            </button>
          )}
        </div>

        {/* ── Mobile hamburger ── */}
        <button
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={toggleMenu}
          className="md:hidden flex flex-col items-center justify-center gap-1.5 rounded-md p-2 text-white/70 hover:text-white"
        >
          <span
            className={`block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${menuOpen ? 'translate-y-2 rotate-45' : ''}`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-current transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`}
          />
        </button>
      </nav>

      {/* ── Mobile slide-in menu ── */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
        style={{ background: 'rgba(10, 14, 26, 0.95)' }}
      >
        <div className="flex flex-col gap-1 px-4 pb-5 pt-2">
          {/* Nav links — only when signed in */}
          {user && !loading && NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={closeMenu}
              className="rounded-md px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
            >
              {label}
            </Link>
          ))}

          <div className="mt-2 border-t border-white/10 pt-3">
            {loading ? (
              <div className="h-9 animate-pulse rounded-lg bg-white/10" />
            ) : user ? (
              <div className="flex flex-col gap-3">
                {/* User info row */}
                <div className="flex items-center gap-3 px-1">
                  <Avatar
                    src={user.avatar_url}
                    name={user.display_name}
                    size="md"
                    teamColor="border-amber-400"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {user.display_name}
                    </p>
                    <p className="truncate text-xs text-white/50">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { closeMenu(); void signOut(); }}
                  className="rounded-lg border border-white/20 px-4 py-2.5 text-left text-sm font-medium text-white/70 hover:border-white/40 hover:text-white"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { closeMenu(); void signInWithGoogle(); }}
                className="btn-primary w-full"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
