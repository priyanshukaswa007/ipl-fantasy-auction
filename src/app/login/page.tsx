'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

// ── Google "G" SVG icon ───────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  // Redirect authenticated users straight to the dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // While we check the session, show nothing to avoid flash
  if (loading || user) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#F5A623]" />
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      {/* Ambient background glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #6B3FA0 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #F5A623 0%, transparent 70%)' }}
        />
      </div>

      {/* Login card */}
      <div className="card-glass relative w-full max-w-md animate-slide-up px-8 py-10 text-center shadow-2xl">

        {/* Logo / title */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg animate-pulse-glow"
            style={{ background: 'linear-gradient(135deg, #F5A623 0%, #FFCA5A 100%)' }}
          >
            🏏
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="text-gradient">IPL Auction</span>
          </h1>
        </div>

        {/* Subtitle */}
        <p className="mb-8 text-base text-white/60">
          Sign in to start your auction
        </p>

        {/* Google sign-in button */}
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-gray-800 shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-white/30">secure sign-in</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {/* Feature bullets */}
        <ul className="mb-8 space-y-2 text-left text-sm text-white/50">
          {[
            'Create private auction leagues',
            'Live bidding with real-time updates',
            'Full IPL 2026 player roster',
          ].map((feat) => (
            <li key={feat} className="flex items-center gap-2">
              <span className="text-[#F5A623]">✦</span>
              {feat}
            </li>
          ))}
        </ul>

        {/* Footer */}
        <p className="text-xs text-white/30">
          By signing in, you agree to our{' '}
          <span className="underline underline-offset-2 cursor-pointer hover:text-white/60 transition-colors">
            terms of service
          </span>
          .
        </p>
      </div>
    </main>
  );
}
