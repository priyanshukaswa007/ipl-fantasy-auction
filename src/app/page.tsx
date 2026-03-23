'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

// ── Fake auction preview ──────────────────────────────────────────────────────

function AuctionPreview() {
  return (
    <div className="relative w-full max-w-sm mx-auto mt-12 lg:mt-0 lg:mx-0 select-none">
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-2xl blur-2xl opacity-40"
        style={{ background: 'radial-gradient(ellipse at center, #6B3FA0 0%, #F5A623 60%, transparent 100%)' }}
        aria-hidden="true"
      />

      {/* Auction card container */}
      <div
        className="relative rounded-2xl p-1"
        style={{ background: 'linear-gradient(135deg, #F5A623 0%, #6B3FA0 100%)' }}
      >
        <div className="rounded-[14px] p-4" style={{ background: '#0D1424' }}>
          {/* Header bar */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#F5A623' }}>
              LIVE AUCTION
            </span>
            <span
              className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse"
              style={{ background: 'rgba(245,166,35,0.15)', color: '#F5A623' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              LIVE
            </span>
          </div>

          {/* Player card */}
          <div
            className="rounded-xl p-4 mb-3 flex items-center gap-4"
            style={{ background: 'linear-gradient(135deg, #1B2A4A 0%, #0F1D36 100%)', border: '1px solid rgba(107,63,160,0.4)' }}
          >
            {/* Player avatar placeholder */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6B3FA0 0%, #1B2A4A 100%)', border: '2px solid #F5A623' }}
            >
              🏏
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-base leading-tight">V. Kohli</div>
              <div className="text-xs mt-0.5" style={{ color: '#9B6FD0' }}>Batsman · RCB</div>
              <div className="flex gap-2 mt-1.5">
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,166,35,0.15)', color: '#F5A623' }}>
                  BAT
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(107,63,160,0.25)', color: '#9B6FD0' }}>
                  Grade A+
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs" style={{ color: '#9B6FD0' }}>Base</div>
              <div className="font-bold" style={{ color: '#F5A623' }}>₹2Cr</div>
            </div>
          </div>

          {/* Current bid */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Current Bid</div>
              <div className="text-2xl font-black" style={{ color: '#F5A623' }}>₹14.5 Cr</div>
              <div className="text-xs" style={{ color: '#9B6FD0' }}>by Rohan K.</div>
            </div>
            {/* Countdown timer */}
            <div
              className="w-14 h-14 rounded-full flex flex-col items-center justify-center"
              style={{
                background: 'conic-gradient(#F5A623 0% 30%, rgba(107,63,160,0.3) 30% 100%)',
                boxShadow: '0 0 18px rgba(245,166,35,0.4)',
              }}
            >
              <div
                className="w-11 h-11 rounded-full flex flex-col items-center justify-center"
                style={{ background: '#0D1424' }}
              >
                <span className="text-xs font-black leading-none" style={{ color: '#F5A623' }}>09</span>
                <span className="text-[9px] leading-none" style={{ color: 'rgba(255,255,255,0.4)' }}>sec</span>
              </div>
            </div>
          </div>

          {/* Bidder chips */}
          <div className="flex gap-2 mb-3">
            {['Rohan K.', 'Priya M.', 'Arjun S.'].map((name, i) => (
              <div
                key={name}
                className="flex-1 text-center text-xs py-1.5 rounded-lg font-medium truncate"
                style={{
                  background: i === 0 ? 'rgba(245,166,35,0.2)' : 'rgba(107,63,160,0.15)',
                  color: i === 0 ? '#F5A623' : 'rgba(255,255,255,0.5)',
                  border: i === 0 ? '1px solid rgba(245,166,35,0.4)' : '1px solid rgba(107,63,160,0.2)',
                }}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Bid button (decorative) */}
          <div
            className="w-full text-center py-2.5 rounded-xl text-sm font-black uppercase tracking-wider cursor-default"
            style={{
              background: 'linear-gradient(135deg, #F5A623 0%, #FFCA5A 100%)',
              color: '#0A0E1A',
              boxShadow: '0 4px 15px rgba(245,166,35,0.35)',
            }}
          >
            Raise Bid — ₹15 Cr
          </div>
        </div>
      </div>

      {/* Floating bid notification */}
      <div
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg"
        style={{ background: '#6B3FA0', color: '#fff', border: '1px solid rgba(155,111,208,0.5)' }}
      >
        +3 bidders
      </div>
    </div>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: '🏟️',
    title: 'Create a League',
    desc: 'Set up a private room and share the invite code with your friends.',
    step: '01',
  },
  {
    icon: '🔨',
    title: 'Run the Auction',
    desc: 'Bid on real IPL players in a live real-time auction with a countdown timer.',
    step: '02',
  },
  {
    icon: '📋',
    title: 'Build Your Squad',
    desc: 'Assemble your dream team of 11 within your budget constraints.',
    step: '03',
  },
  {
    icon: '🏆',
    title: 'Win the Season',
    desc: 'Earn fantasy points as your players perform across every IPL match.',
    step: '04',
  },
];

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '⚡',
    title: 'Live Auction',
    desc: 'Real-time bidding with a live countdown timer and instant bid updates.',
  },
  {
    icon: '🐍',
    title: 'Snake Draft',
    desc: 'Prefer a fairer format? Switch to snake draft mode for your league.',
  },
  {
    icon: '📊',
    title: 'Auto Scoring',
    desc: 'Fantasy points calculated automatically after every IPL match.',
  },
  {
    icon: '🔄',
    title: 'Trade Players',
    desc: 'Swap players with friends mid-season to strengthen your squad.',
  },
  {
    icon: '🥇',
    title: 'Leaderboard',
    desc: 'Live standings updated throughout the season so you always know who\'s on top.',
  },
  {
    icon: '📱',
    title: 'Mobile First',
    desc: 'Designed for mobile — manage your team from anywhere, any time.',
  },
];

// ── Decorative background shapes ─────────────────────────────────────────────

function HeroBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Large blurred orb — gold */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20"
        style={{ background: '#F5A623' }}
      />
      {/* Large blurred orb — purple */}
      <div
        className="absolute -bottom-20 -right-20 w-[500px] h-[500px] rounded-full blur-3xl opacity-15"
        style={{ background: '#6B3FA0' }}
      />
      {/* Cricket ball silhouette */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-[0.03]"
        style={{ border: '60px solid #F5A623' }}
      />
      {/* Diagonal stripe pattern */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #F5A623 0px, #F5A623 1px, transparent 1px, transparent 40px)',
        }}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, loading } = useAuth();

  const primaryHref = user ? '/dashboard' : '/login';
  const primaryLabel = user ? 'Go to Dashboard' : 'Create Your League';
  const secondaryHref = '/dashboard';
  const secondaryLabel = user ? 'My Leagues' : 'Join a League';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0A0E1A' }}>

      {/* Navbar is provided by layout.tsx — no duplicate here */}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative flex-1 flex items-center overflow-hidden px-4 sm:px-8 py-20 lg:py-28">
        <HeroBg />

        <div className="relative z-10 w-full max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left — copy */}
            <div>
              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 animate-slide-up"
                style={{
                  background: 'rgba(107,63,160,0.2)',
                  border: '1px solid rgba(107,63,160,0.4)',
                  color: '#9B6FD0',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                IPL 2026 Season Live
              </div>

              {/* Heading */}
              <h1
                className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight text-white mb-6 animate-slide-up"
                style={{ animationDelay: '0.05s' }}
              >
                The Ultimate{' '}
                <br className="hidden sm:block" />
                <span className="text-gradient">Fantasy Auction</span>
              </h1>

              {/* Subtitle */}
              <p
                className="text-base sm:text-lg leading-relaxed mb-8 max-w-xl animate-slide-up"
                style={{ color: 'rgba(255,255,255,0.65)', animationDelay: '0.1s' }}
              >
                Create private leagues, auction real IPL players with friends, and
                compete all season long. Your team. Your strategy. Your glory.
              </p>

              {/* CTAs */}
              <div
                className="flex flex-col sm:flex-row gap-3 animate-slide-up"
                style={{ animationDelay: '0.15s' }}
              >
                <Link href={primaryHref} className="btn-primary px-6 py-3 text-base">
                  {primaryLabel}
                </Link>
                <Link href={secondaryHref} className="btn-secondary px-6 py-3 text-base">
                  {secondaryLabel}
                </Link>
              </div>

              {/* Social proof */}
              <div
                className="flex items-center gap-4 mt-8 text-sm animate-slide-up"
                style={{ color: 'rgba(255,255,255,0.4)', animationDelay: '0.2s' }}
              >
                <span>🏏 Real IPL Players</span>
                <span className="w-1 h-1 rounded-full bg-current" />
                <span>⚡ Live Auction</span>
                <span className="w-1 h-1 rounded-full bg-current" />
                <span>🏆 Full Season</span>
              </div>
            </div>

            {/* Right — preview graphic */}
            <div className="flex justify-center lg:justify-end">
              <AuctionPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-8 py-20" style={{ background: 'rgba(27,42,74,0.15)' }}>
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <p
              className="text-xs font-bold tracking-widest uppercase mb-3"
              style={{ color: '#F5A623' }}
            >
              How It Works
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              From setup to <span className="text-gradient">championship</span>
            </h2>
          </div>

          {/* Steps grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s) => (
              <div
                key={s.step}
                className="card-glass relative p-6 group hover:scale-[1.02] transition-transform duration-200"
              >
                {/* Step number */}
                <div
                  className="absolute top-4 right-4 text-4xl font-black leading-none select-none"
                  style={{ color: 'rgba(245,166,35,0.08)' }}
                >
                  {s.step}
                </div>

                {/* Icon */}
                <div className="text-3xl mb-4">{s.icon}</div>

                {/* Step label */}
                <div
                  className="text-xs font-bold tracking-widest uppercase mb-1"
                  style={{ color: '#F5A623' }}
                >
                  Step {s.step}
                </div>

                <h3 className="text-base font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {s.desc}
                </p>

                {/* Connector line (hidden on last) */}
                {s.step !== '04' && (
                  <div
                    className="absolute top-1/2 -right-2.5 w-5 h-px hidden lg:block"
                    style={{ background: 'rgba(245,166,35,0.3)' }}
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-8 py-20">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <p
              className="text-xs font-bold tracking-widest uppercase mb-3"
              style={{ color: '#F5A623' }}
            >
              Features
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Everything you need to{' '}
              <span className="text-gradient">dominate</span>
            </h2>
          </div>

          {/* Features grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card-glass p-6 group hover:scale-[1.02] transition-transform duration-200"
                style={{ borderColor: 'rgba(107,63,160,0.25)' }}
              >
                {/* Icon bubble */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                  style={{
                    background: 'rgba(107,63,160,0.2)',
                    border: '1px solid rgba(107,63,160,0.35)',
                  }}
                >
                  {f.icon}
                </div>
                <h3 className="text-base font-bold text-white mb-1.5">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-8 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <div
            className="card-glass rounded-2xl px-8 py-12 relative overflow-hidden"
            style={{ borderColor: 'rgba(245,166,35,0.25)' }}
          >
            {/* Background glow */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, #F5A623 0%, transparent 70%)' }}
              aria-hidden="true"
            />

            <div className="relative z-10">
              <div className="text-4xl mb-4">🏆</div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Ready to{' '}
                <span className="text-gradient">win the auction?</span>
              </h2>
              <p className="mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Join thousands of cricket fans running their own fantasy IPL leagues.
              </p>
              <Link
                href={user ? '/dashboard' : '/login'}
                className="btn-primary px-8 py-3.5 text-base inline-flex"
              >
                {loading ? '...' : user ? 'Open Dashboard' : 'Start for Free'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer
        className="px-4 sm:px-8 py-10 mt-auto"
        style={{ borderTop: '1px solid rgba(31,41,55,0.6)' }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          {/* Branding */}
          <div className="flex items-center gap-2">
            <span className="text-xl">🏏</span>
            <div>
              <div className="font-black text-white">IPL Fantasy Auction</div>
              <div style={{ color: 'rgba(255,255,255,0.4)' }}>
                Built for cricket fans, by cricket fans
              </div>
            </div>
          </div>

          {/* Links */}
          <nav className="flex gap-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Sign In
            </Link>
          </nav>

          {/* Disclaimer */}
          <div className="text-center sm:text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <div>Not affiliated with BCCI or IPL.</div>
            <div>© {new Date().getFullYear()} IPL Fantasy Auction</div>
          </div>
        </div>
      </footer>

    </div>
  );
}
