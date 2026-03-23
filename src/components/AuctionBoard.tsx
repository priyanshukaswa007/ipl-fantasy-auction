'use client';

import { useState, useEffect, useRef } from 'react';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import { useAuction } from '@/hooks/useAuction';
import { AuctionEngine } from '@/lib/auction-engine';
import { PlayerCard } from '@/components/PlayerCard';
import { BidPanel } from '@/components/BidPanel';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import type { Player, RoomMember, AuctionPick } from '@/types';
import { TEAM_COLORS } from '@/types';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface AuctionBoardProps {
  roomCode: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function RoleFilterButton({
  role,
  active,
  count,
  onClick,
}: {
  role: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-full text-xs font-semibold transition-all',
        active
          ? 'bg-amber-500 text-slate-900'
          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700',
      )}
    >
      {role} ({count})
    </button>
  );
}

function TeamRow({ member, picks }: { member: RoomMember; picks: AuctionPick[] }) {
  const memberPicks = picks.filter((p) => p.user_id === member.user_id);
  const squadCount = memberPicks.length;
  const budgetPercent = Math.min(
    100,
    Math.max(
      0,
      (member.budget_remaining / (member.budget_remaining + memberPicks.reduce((s, p) => s + p.bid_amount, 0) || 1)) * 100,
    ),
  );

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800/60 border border-white/5">
      <div
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: '#f59e0b' }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {member.team_name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 shrink-0">
            {formatCurrency(member.budget_remaining)}
          </span>
        </div>
      </div>
      <span className="text-xs text-slate-500 shrink-0">{squadCount}p</span>
    </div>
  );
}

function SquadPlayerRow({ pick }: { pick: AuctionPick }) {
  const player = pick.player;
  if (!player) return null;
  const colors = TEAM_COLORS[player.team];
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-slate-800/40 border border-white/5">
      <div
        className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
        style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
      >
        {getInitials(player.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">{player.name}</p>
        <p className="text-[10px] text-slate-500">{player.role}</p>
      </div>
      <span className="text-xs text-amber-400 font-bold shrink-0">
        {formatCurrency(pick.bid_amount)}
      </span>
    </div>
  );
}

function AvailablePlayerRow({
  player,
  onNominate,
  isHost,
}: {
  player: Player;
  onNominate: (id: string) => void;
  isHost: boolean;
}) {
  const colors = TEAM_COLORS[player.team];
  return (
    <div
      className={cn(
        'flex items-center gap-2 py-2 px-2 rounded-lg border border-white/5 bg-slate-800/40',
        isHost && 'hover:bg-slate-700/60 cursor-pointer transition-colors',
      )}
      onClick={isHost ? () => onNominate(player.id) : undefined}
      role={isHost ? 'button' : undefined}
      tabIndex={isHost ? 0 : undefined}
      onKeyDown={
        isHost
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onNominate(player.id);
            }
          : undefined
      }
    >
      <div
        className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
        style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
      >
        {getInitials(player.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">{player.name}</p>
        <p className="text-[10px] text-slate-500 truncate">
          {player.team} · {player.role}
        </p>
      </div>
      <span className="text-xs text-slate-400 shrink-0">
        {formatCurrency(player.base_price)}
      </span>
    </div>
  );
}

// ── Confetti (simple CSS particles) ──────────────────────────────────────────

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const items = Array.from({ length: 20 }, (_, i) => i);
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#a855f7', '#ec4899'];
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {items.map((i) => (
        <div
          key={i}
          className="absolute animate-[confetti_1s_ease-out_forwards]"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-10px',
            width: 8 + Math.random() * 8,
            height: 8 + Math.random() * 8,
            background: colors[i % colors.length],
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${Math.random() * 0.6}s`,
            animationDuration: `${0.8 + Math.random() * 0.8}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AuctionBoard({ roomCode }: AuctionBoardProps) {
  const {
    auctionState,
    currentPlayer,
    members,
    picks,
    availablePlayers,
    myMember,
    myPicks,
    isHost,
    loading,
    room,
    placeBid,
    nominatePlayer,
    nominateNext,
    markSold,
    markUnsold,
    pauseAuction,
    resumeAuction,
  } = useAuction(roomCode);

  // Use real room settings, with sensible fallbacks
  const settings = room?.settings ?? {
    budget: 120,
    squad_size_min: 18,
    squad_size_max: 25,
    max_players: 10,
    auction_mode: 'live_auction' as const,
    composition_rules: {
      max_overseas: 8,
      min_wicketkeepers: 2,
      min_batters: 3,
      min_bowlers: 3,
      min_allrounders: 1,
      enabled: true,
    },
    bid_increment: 0.25,
    timer_seconds: 15,
    draft_timer_seconds: 60,
    rtm_enabled: false,
    trade_window: 'always' as const,
    commissioner_mode: false,
    player_order: 'random' as const,
  };

  const [roleFilter, setRoleFilter] = useState<Player['role'] | 'All'>('All');
  const [showConfetti, setShowConfetti] = useState(false);
  const [mobileTab, setMobileTab] = useState<'main' | 'teams' | 'squad' | 'players'>('main');
  const [endingAuction, setEndingAuction] = useState(false);
  const prevSoldCount = useRef(auctionState.sold_count);

  // Confetti on sale
  useEffect(() => {
    if (auctionState.sold_count > prevSoldCount.current) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 2000);
      prevSoldCount.current = auctionState.sold_count;
      return () => clearTimeout(t);
    }
    prevSoldCount.current = auctionState.sold_count;
  }, [auctionState.sold_count]);

  // Bid permission
  const myPlayerObjects = myPicks
    .map((p) => p.player)
    .filter((p): p is Player => Boolean(p));

  const bidPermission =
    myMember && currentPlayer
      ? AuctionEngine.canBidForPlayer(
          myMember,
          currentPlayer,
          auctionState,
          settings,
          myPlayerObjects,
        )
      : { allowed: false, reason: 'No player on the block' };

  // Current bidder display name
  const currentBidderMember = members.find(
    (m) => m.user_id === auctionState.current_bidder_id,
  );
  const currentBidderName = currentBidderMember?.team_name ?? currentBidderMember?.user?.display_name ?? null;

  // Available players filtered
  const ROLES: Array<Player['role']> = ['Batter', 'Bowler', 'All-Rounder', 'Wicketkeeper'];
  const filteredAvailable =
    roleFilter === 'All'
      ? availablePlayers
      : availablePlayers.filter((p) => p.role === roleFilter);

  const roleCounts = ROLES.reduce(
    (acc, role) => {
      acc[role] = availablePlayers.filter((p) => p.role === role).length;
      return acc;
    },
    {} as Record<Player['role'], number>,
  );

  async function handleEndAuction() {
    setEndingAuction(true);
    // nominateNext will end the auction if no players remain
    await nominateNext();
    setEndingAuction(false);
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">Loading auction...</p>
        </div>
      </div>
    );
  }

  // ── Completed state ──────────────────────────────────────────────────────────

  if (auctionState.status === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-5xl font-black text-amber-400">Auction Complete!</p>
          <p className="text-slate-400">
            {auctionState.sold_count} players sold &middot; {auctionState.unsold_count} unsold
          </p>
        </div>
      </div>
    );
  }

  // ── Left sidebar ─────────────────────────────────────────────────────────────

  const LeftSidebar = (
    <aside className="flex flex-col gap-4">
      {/* Status bar */}
      <Card>
        <CardBody className="py-3 px-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 uppercase tracking-widest">Round</span>
            <span className="text-sm font-bold text-white">{auctionState.round}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Badge variant="success">{auctionState.sold_count} Sold</Badge>
            <Badge variant="warning">{auctionState.unsold_count} Unsold</Badge>
            <Badge variant="default">{availablePlayers.length} Left</Badge>
          </div>
          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden mt-1">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{
                width: `${
                  ((auctionState.sold_count + auctionState.unsold_count) /
                    Math.max(1, auctionState.sold_count + auctionState.unsold_count + availablePlayers.length)) *
                  100
                }%`,
              }}
            />
          </div>
        </CardBody>
      </Card>

      {/* Teams */}
      <Card>
        <CardHeader className="py-3 px-4">
          <h2 className="text-sm font-bold text-white">Teams</h2>
        </CardHeader>
        <CardBody className="py-2 px-3 flex flex-col gap-1.5">
          {members.map((m) => (
            <TeamRow key={m.id} member={m} picks={picks} />
          ))}
        </CardBody>
      </Card>
    </aside>
  );

  // ── Right sidebar ─────────────────────────────────────────────────────────────

  const RightSidebar = (
    <aside className="flex flex-col gap-4">
      {/* My Squad */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">My Squad</h2>
            {myMember && (
              <span className="text-xs text-emerald-400 font-semibold">
                {formatCurrency(myMember.budget_remaining)} left
              </span>
            )}
          </div>
        </CardHeader>
        <CardBody className="py-2 px-3 flex flex-col gap-1.5 max-h-56 overflow-y-auto">
          {myPicks.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4">No players yet</p>
          ) : (
            myPicks.map((pick) => <SquadPlayerRow key={pick.id} pick={pick} />)
          )}
        </CardBody>
      </Card>

      {/* Available players */}
      <Card className="flex-1">
        <CardHeader className="py-3 px-4">
          <h2 className="text-sm font-bold text-white mb-2">Available</h2>
          <div className="flex flex-wrap gap-1">
            <RoleFilterButton
              role="All"
              active={roleFilter === 'All'}
              count={availablePlayers.length}
              onClick={() => setRoleFilter('All')}
            />
            {ROLES.map((r) => (
              <RoleFilterButton
                key={r}
                role={r}
                active={roleFilter === r}
                count={roleCounts[r]}
                onClick={() => setRoleFilter(r as Player['role'])}
              />
            ))}
          </div>
        </CardHeader>
        <CardBody className="py-2 px-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto">
          {filteredAvailable.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4">No players available</p>
          ) : (
            filteredAvailable.map((p) => (
              <AvailablePlayerRow
                key={p.id}
                player={p}
                onNominate={nominatePlayer}
                isHost={isHost}
              />
            ))
          )}
        </CardBody>
      </Card>
    </aside>
  );

  // ── Center panel ──────────────────────────────────────────────────────────────

  const CenterPanel = (
    <main className="flex flex-col items-center gap-6">
      {/* Player on the block */}
      {currentPlayer ? (
        <div className="flex flex-col items-center gap-4 w-full">
          {/* PlayerCard — large */}
          <div className="animate-[fadeIn_0.4s_ease-out]">
            <PlayerCard
              player={currentPlayer}
              size="lg"
              showStats
              bidAmount={auctionState.current_bid > 0 ? auctionState.current_bid : undefined}
            />
          </div>

          {/* Current bidder */}
          {currentBidderName && (
            <div className="flex items-center gap-2 animate-[bid-pop_0.3s_ease-out]">
              <Avatar name={currentBidderName} size="sm" />
              <span className="text-sm text-amber-400 font-bold">
                {currentBidderName} is leading
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="h-24 w-24 rounded-full bg-slate-800/80 border-2 border-dashed border-slate-700 flex items-center justify-center">
            <span className="text-4xl" aria-hidden="true">🏏</span>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-300">
              {auctionState.status === 'not_started'
                ? 'Waiting for auction to start'
                : auctionState.status === 'paused'
                  ? 'Auction Paused'
                  : 'Waiting for next player...'}
            </p>
            {isHost && auctionState.status !== 'not_started' && (
              <p className="text-xs text-slate-500 mt-1">
                Use "Next Player" below to nominate
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bid panel */}
      <BidPanel
        currentBid={auctionState.current_bid}
        bidIncrement={settings.bid_increment}
        onBid={placeBid}
        canBid={bidPermission.allowed}
        bidReason={bidPermission.reason}
        timeRemaining={auctionState.timer_remaining}
        timerActive={
          auctionState.status === 'in_progress' && !!currentPlayer
        }
        currentBidder={currentBidderName}
        totalTimerSeconds={settings.timer_seconds}
        onTimerComplete={() => {
          // Non-host clients: timer expiry is visual only; host drives markSold/markUnsold
        }}
        className="w-full max-w-xs"
      />
    </main>
  );

  // ── Host controls bar ─────────────────────────────────────────────────────────

  const HostControls = isHost && (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur border-t border-white/10 px-4 py-3">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-2">
        <span className="text-xs text-amber-400 font-bold uppercase tracking-widest mr-2">
          Host
        </span>

        <Button
          size="sm"
          onClick={nominateNext}
          disabled={auctionState.status === 'in_progress' && !!currentPlayer}
        >
          Next Player
        </Button>

        {auctionState.status === 'paused' ? (
          <Button size="sm" variant="secondary" onClick={resumeAuction}>
            Resume
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={pauseAuction}
            disabled={auctionState.status !== 'in_progress'}
          >
            Pause
          </Button>
        )}

        <Button
          size="sm"
          onClick={markSold}
          disabled={
            !currentPlayer ||
            !auctionState.current_bidder_id
          }
          className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-none"
        >
          Mark Sold
        </Button>

        <Button
          size="sm"
          variant="danger"
          onClick={markUnsold}
          disabled={!currentPlayer}
        >
          Mark Unsold
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleEndAuction}
          loading={endingAuction}
          className="ml-auto text-slate-500 hover:text-red-400"
        >
          End Auction
        </Button>
      </div>
    </div>
  );

  // ── Mobile tab navigation ─────────────────────────────────────────────────────

  const MobileNav = (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur border-t border-white/10 flex">
      {(['main', 'teams', 'squad', 'players'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => setMobileTab(tab)}
          className={cn(
            'flex-1 py-3 text-xs font-semibold capitalize transition-colors',
            mobileTab === tab ? 'text-amber-400' : 'text-slate-500',
          )}
        >
          {tab === 'main' ? 'Auction' : tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </nav>
  );

  // ── Full layout ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-purple-600/5 blur-3xl" />
      </div>

      <Confetti active={showConfetti} />

      {/* ── Desktop 3-column grid ─── */}
      <div
        className={cn(
          'relative z-10 hidden lg:grid gap-6 px-4 py-6 max-w-[1400px] mx-auto',
          'grid-cols-[280px_1fr_280px]',
          isHost && 'pb-20',
        )}
      >
        {LeftSidebar}
        {CenterPanel}
        {RightSidebar}
      </div>

      {/* ── Mobile layout ─── */}
      <div className="lg:hidden relative z-10 px-4 py-4 pb-28">
        {mobileTab === 'main' && CenterPanel}
        {mobileTab === 'teams' && LeftSidebar}
        {mobileTab === 'squad' && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">My Squad</h2>
                  {myMember && (
                    <span className="text-xs text-emerald-400 font-semibold">
                      {formatCurrency(myMember.budget_remaining)} left
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardBody className="py-2 px-3 flex flex-col gap-1.5">
                {myPicks.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-4">No players yet</p>
                ) : (
                  myPicks.map((pick) => <SquadPlayerRow key={pick.id} pick={pick} />)
                )}
              </CardBody>
            </Card>
          </div>
        )}
        {mobileTab === 'players' && RightSidebar}
      </div>

      {/* Host controls (desktop: fixed bar) */}
      {HostControls}

      {/* Mobile nav */}
      {MobileNav}
    </div>
  );
}

export default AuctionBoard;
