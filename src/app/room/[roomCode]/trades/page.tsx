'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useRoom } from '@/hooks/useRoom';
import { TradeModal, type ProposedTrade } from '@/components/TradeModal';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn, timeAgo } from '@/lib/utils';
import type { Trade, TradeStatus } from '@/types';

// ── Extended trade type ────────────────────────────────────────────────────────

interface TradeWithUsers extends Omit<Trade, 'proposer' | 'receiver'> {
  proposer?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  receiver?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  // Resolved player names
  offered_players_data?: { id: string; name: string; team: string; role: string }[];
  requested_players_data?: { id: string; name: string; team: string; role: string }[];
}

// ── Tab type ──────────────────────────────────────────────────────────────────

type TabId = 'propose' | 'incoming' | 'history';

// ── Trade status badge ────────────────────────────────────────────────────────

const STATUS_BADGE: Record<TradeStatus, { variant: BadgeVariant; label: string }> = {
  pending:  { variant: 'warning', label: 'Pending' },
  accepted: { variant: 'success', label: 'Accepted' },
  rejected: { variant: 'danger',  label: 'Rejected' },
  vetoed:   { variant: 'danger',  label: 'Vetoed' },
};

// ── Player name chips ─────────────────────────────────────────────────────────

function PlayerChips({
  playerIds,
  players,
  color = 'amber',
}: {
  playerIds: string[];
  players: { id: string; name: string; team: string; role: string }[];
  color?: 'amber' | 'emerald';
}) {
  if (playerIds.length === 0) {
    return <span className="text-xs text-slate-500 italic">None</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {playerIds.map((pid) => {
        const p = players.find((x) => x.id === pid);
        return (
          <span
            key={pid}
            className={cn(
              'text-xs px-2 py-0.5 rounded-full border font-medium',
              color === 'amber'
                ? 'bg-amber-900/40 border-amber-600/30 text-amber-300'
                : 'bg-emerald-900/40 border-emerald-600/30 text-emerald-300',
            )}
          >
            {p?.name ?? pid.slice(0, 8)}
          </span>
        );
      })}
    </div>
  );
}

// ── Trade card ────────────────────────────────────────────────────────────────

function TradeCard({
  trade,
  players,
  currentUserId,
  isHost,
  commissionerMode,
  onAccept,
  onReject,
  onVeto,
  actionLoading,
}: {
  trade: TradeWithUsers;
  players: { id: string; name: string; team: string; role: string }[];
  currentUserId: string;
  isHost: boolean;
  commissionerMode: boolean;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onVeto?: (id: string) => void;
  actionLoading: string | null;
}) {
  const status = STATUS_BADGE[trade.status];
  const isReceiver = trade.receiver_id === currentUserId;
  const isProposer = trade.proposer_id === currentUserId;

  return (
    <div className="rounded-xl bg-slate-800/60 border border-white/8 p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar
            src={trade.proposer?.avatar_url}
            name={trade.proposer?.display_name ?? 'Unknown'}
            size="sm"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {trade.proposer?.display_name ?? 'Unknown'}
              <span className="text-slate-500 font-normal"> → </span>
              {trade.receiver?.display_name ?? 'Unknown'}
            </p>
            <p className="text-xs text-slate-500">{timeAgo(trade.created_at)}</p>
          </div>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {/* Players columns */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            {isReceiver ? 'They offer' : 'Offers'}
          </p>
          <PlayerChips playerIds={trade.players_offered} players={players} color="amber" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            {isReceiver ? 'They want' : 'Wants'}
          </p>
          <PlayerChips playerIds={trade.players_requested} players={players} color="emerald" />
        </div>
      </div>

      {/* Actions */}
      {trade.status === 'pending' && (
        <div className="flex items-center gap-2 pt-1">
          {isReceiver && (
            <>
              <Button
                size="sm"
                onClick={() => onAccept?.(trade.id)}
                loading={actionLoading === `accept-${trade.id}`}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => onReject?.(trade.id)}
                loading={actionLoading === `reject-${trade.id}`}
              >
                Reject
              </Button>
            </>
          )}
          {isProposer && !isReceiver && (
            <span className="text-xs text-slate-500 italic">Waiting for response…</span>
          )}
          {isHost && commissionerMode && !isReceiver && !isProposer && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onVeto?.(trade.id)}
              loading={actionLoading === `veto-${trade.id}`}
            >
              Veto
            </Button>
          )}
          {isHost && commissionerMode && (isReceiver || isProposer) && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-xs"
              onClick={() => onVeto?.(trade.id)}
              loading={actionLoading === `veto-${trade.id}`}
            >
              Host Veto
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TradesPage() {
  const params   = useParams<{ roomCode: string }>();
  const roomCode = params?.roomCode ?? '';
  const { user, loading: authLoading } = useAuth();

  const { room, members, myPicks, picks, isHost, loading: roomLoading } = useRoom(roomCode);

  const [activeTab, setActiveTab]         = useState<TabId>('propose');
  const [trades, setTrades]               = useState<TradeWithUsers[]>([]);
  const [players, setPlayers]             = useState<{ id: string; name: string; team: string; role: string }[]>([]);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Fetch all player names for chips ────────────────────────────────────

  useEffect(() => {
    // Build player list from picks already loaded
    const playerMap = new Map<string, { id: string; name: string; team: string; role: string }>();
    for (const pick of picks) {
      if (pick.player) {
        playerMap.set(pick.player_id, {
          id: pick.player_id,
          name: pick.player.name,
          team: pick.player.team,
          role: pick.player.role,
        });
      }
    }
    setPlayers(Array.from(playerMap.values()));
  }, [picks]);

  // ── Fetch trades ─────────────────────────────────────────────────────────

  const fetchTrades = useCallback(async () => {
    if (!room) return;
    const supabase = getSupabaseBrowser();

    const { data } = await supabase
      .from('trades')
      .select('*, proposer:users!trades_proposer_id_fkey(*), receiver:users!trades_receiver_id_fkey(*)')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false });

    setTrades((data ?? []) as TradeWithUsers[]);
  }, [room]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // ── Realtime subscription ────────────────────────────────────────────────

  useEffect(() => {
    if (!room) return;
    const supabase = getSupabaseBrowser();

    const channel = supabase
      .channel(`trades:${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades', filter: `room_id=eq.${room.id}` },
        () => { fetchTrades(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room, fetchTrades]);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handlePropose(trade: ProposedTrade) {
    if (!room || !user) return;
    const supabase = getSupabaseBrowser();

    const { error } = await supabase.from('trades').insert({
      room_id: room.id,
      proposer_id: user.id,
      receiver_id: trade.receiver_id,
      players_offered: trade.players_offered,
      players_requested: trade.players_requested,
      status: 'pending',
    });

    if (error) throw new Error(error.message);

    // Broadcast notification via channel
    await supabase.channel(`trades:${room.id}`).send({
      type: 'broadcast',
      event: 'trade_proposed',
      payload: { proposer: user.display_name, receiver_id: trade.receiver_id },
    });

    await fetchTrades();
    setActiveTab('history');
  }

  async function handleAccept(tradeId: string) {
    if (!room || !user) return;
    const supabase = getSupabaseBrowser();

    setActionLoading(`accept-${tradeId}`);
    try {
      const trade = trades.find((t) => t.id === tradeId);
      if (!trade) return;

      // Swap ownership: players_offered -> receiver, players_requested -> proposer
      for (const playerId of trade.players_offered) {
        await supabase
          .from('auction_picks')
          .update({ user_id: trade.receiver_id })
          .eq('room_id', room.id)
          .eq('player_id', playerId);
      }

      for (const playerId of trade.players_requested) {
        await supabase
          .from('auction_picks')
          .update({ user_id: trade.proposer_id })
          .eq('room_id', room.id)
          .eq('player_id', playerId);
      }

      // Mark trade accepted
      await supabase.from('trades').update({ status: 'accepted' }).eq('id', tradeId);

      // Broadcast
      await supabase.channel(`trades:${room.id}`).send({
        type: 'broadcast',
        event: 'trade_accepted',
        payload: { trade_id: tradeId },
      });

      await fetchTrades();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(tradeId: string) {
    const supabase = getSupabaseBrowser();
    setActionLoading(`reject-${tradeId}`);
    try {
      await supabase.from('trades').update({ status: 'rejected' }).eq('id', tradeId);
      await fetchTrades();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleVeto(tradeId: string) {
    const supabase = getSupabaseBrowser();
    setActionLoading(`veto-${tradeId}`);
    try {
      await supabase.from('trades').update({ status: 'vetoed' }).eq('id', tradeId);
      await fetchTrades();
    } finally {
      setActionLoading(null);
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const incomingTrades = trades.filter(
    (t) => t.receiver_id === user?.id && t.status === 'pending',
  );

  const commissionerMode = room?.settings.commissioner_mode ?? false;
  const tradeWindowClosed = room?.settings.trade_window === 'closed';

  // ── Loading state ─────────────────────────────────────────────────────────

  if (authLoading || roomLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center gap-4">
        <p className="text-xl font-semibold text-white">Room not found.</p>
        <Link href="/dashboard">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'propose', label: 'Propose Trade' },
    { id: 'incoming', label: 'Incoming', count: incomingTrades.length },
    { id: 'history', label: 'History', count: trades.length },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 right-0 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-purple-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/room/${roomCode}/leaderboard`}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Back">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">Trade Center</h1>
            <p className="text-sm text-slate-400">{room.name} &middot; IPL {room.season}</p>
          </div>
        </div>

        {/* Trade window closed banner */}
        {tradeWindowClosed && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-900/30 border border-red-500/40 text-red-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-sm font-medium">The trade window is currently closed. New trades cannot be proposed.</p>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-slate-900/60 border border-white/8 rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150',
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-900 shadow-md shadow-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5',
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                    activeTab === tab.id
                      ? 'bg-slate-900/40 text-slate-900'
                      : 'bg-amber-500/20 text-amber-400',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}

        {/* ── Propose ── */}
        {activeTab === 'propose' && (
          <Card>
            <CardBody className="flex flex-col items-center gap-4 py-10">
              <div className="h-16 w-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400" aria-hidden="true">
                  <path d="M16 3h5v5"/>
                  <path d="M8 3H3v5"/>
                  <path d="M21 3l-7 7"/>
                  <path d="M3 3l7 7"/>
                  <path d="M16 21h5v-5"/>
                  <path d="M8 21H3v-5"/>
                  <path d="M21 21l-7-7"/>
                  <path d="M3 21l7-7"/>
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold text-white">Propose a Trade</h2>
                <p className="text-sm text-slate-400 mt-1 max-w-xs">
                  Select a trade partner, choose players to offer, and request players in return.
                </p>
              </div>
              <Button
                onClick={() => setTradeModalOpen(true)}
                disabled={tradeWindowClosed || myPicks.length === 0}
              >
                Start Trade Proposal
              </Button>
              {myPicks.length === 0 && (
                <p className="text-xs text-slate-500">You need players in your squad to propose a trade.</p>
              )}
            </CardBody>
          </Card>
        )}

        {/* ── Incoming ── */}
        {activeTab === 'incoming' && (
          <div className="flex flex-col gap-3">
            {incomingTrades.length === 0 ? (
              <Card>
                <CardBody className="flex flex-col items-center gap-2 py-10 text-center">
                  <p className="text-2xl" aria-hidden="true">📥</p>
                  <p className="text-white font-semibold">No incoming trades</p>
                  <p className="text-sm text-slate-500">Pending trade proposals sent to you will appear here.</p>
                </CardBody>
              </Card>
            ) : (
              incomingTrades.map((trade) => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  players={players}
                  currentUserId={user?.id ?? ''}
                  isHost={isHost}
                  commissionerMode={commissionerMode}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  onVeto={handleVeto}
                  actionLoading={actionLoading}
                />
              ))
            )}
          </div>
        )}

        {/* ── History ── */}
        {activeTab === 'history' && (
          <div className="flex flex-col gap-3">
            {trades.length === 0 ? (
              <Card>
                <CardBody className="flex flex-col items-center gap-2 py-10 text-center">
                  <p className="text-2xl" aria-hidden="true">📋</p>
                  <p className="text-white font-semibold">No trades yet</p>
                  <p className="text-sm text-slate-500">All trade activity in this room will appear here.</p>
                </CardBody>
              </Card>
            ) : (
              trades.map((trade) => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  players={players}
                  currentUserId={user?.id ?? ''}
                  isHost={isHost}
                  commissionerMode={commissionerMode}
                  onVeto={handleVeto}
                  actionLoading={actionLoading}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Trade proposal modal */}
      {room && user && (
        <TradeModal
          isOpen={tradeModalOpen}
          onClose={() => setTradeModalOpen(false)}
          room={room}
          members={members}
          myPicks={myPicks}
          allPicks={picks}
          currentUserId={user.id}
          onPropose={handlePropose}
        />
      )}
    </div>
  );
}
