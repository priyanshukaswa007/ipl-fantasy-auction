'use client';

import { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import type { Room, RoomMember, User } from '@/types';
import type { PickWithPlayer, MemberWithUser } from '@/hooks/useRoom';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ProposedTrade {
  receiver_id: string;
  players_offered: string[];  // player IDs
  players_requested: string[];
}

export interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  members: MemberWithUser[];
  myPicks: PickWithPlayer[];
  allPicks: PickWithPlayer[];
  currentUserId: string;
  onPropose: (trade: ProposedTrade) => Promise<void>;
}

// ── Step indicator ─────────────────────────────────────────────────────────────

const STEPS = ['Partner', 'Offer', 'Request', 'Review'] as const;
type Step = 0 | 1 | 2 | 3;

function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((label, idx) => {
        const done    = idx < current;
        const active  = idx === current;
        const isLast  = idx === STEPS.length - 1;

        return (
          <div key={label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300',
                  done  && 'bg-emerald-500 border-emerald-400 text-white',
                  active && 'bg-amber-500 border-amber-400 text-slate-900 shadow-lg shadow-amber-500/40',
                  !done && !active && 'bg-slate-800 border-slate-600 text-slate-500',
                )}
              >
                {done ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap',
                  active ? 'text-amber-400' : done ? 'text-emerald-400' : 'text-slate-600',
                )}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-1 transition-all duration-300',
                  done ? 'bg-emerald-500' : 'bg-slate-700',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Player select row ─────────────────────────────────────────────────────────

function PlayerSelectRow({
  pick,
  selected,
  onToggle,
  disabled,
}: {
  pick: PickWithPlayer;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const p = pick.player;
  if (!p) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left',
        'transition-all duration-150',
        selected
          ? 'bg-amber-500/15 border-amber-500/60 shadow-sm shadow-amber-500/20'
          : 'bg-slate-800/60 border-white/5 hover:border-white/15 hover:bg-slate-800',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {/* Checkbox */}
      <div
        className={cn(
          'h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
          selected ? 'bg-amber-500 border-amber-400' : 'border-slate-600',
        )}
      >
        {selected && (
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{p.name}</p>
        <p className="text-xs text-slate-400">{p.team} &middot; {p.role}</p>
      </div>

      {/* Rating pill */}
      <span
        className={cn(
          'text-xs font-bold px-1.5 py-0.5 rounded-md shrink-0',
          p.rating >= 85 ? 'bg-emerald-900/60 text-emerald-300' :
          p.rating >= 70 ? 'bg-blue-900/60 text-blue-300' :
          p.rating >= 55 ? 'bg-amber-900/60 text-amber-300' :
                           'bg-slate-700 text-slate-400',
        )}
      >
        {p.rating}
      </span>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TradeModal({
  isOpen,
  onClose,
  room,
  members,
  myPicks,
  allPicks,
  currentUserId,
  onPropose,
}: TradeModalProps) {
  const [step, setStep]                   = useState<Step>(0);
  const [partnerId, setPartnerId]         = useState<string>('');
  const [offeredIds, setOfferedIds]       = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds]   = useState<Set<string>>(new Set());
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);

  // Other members (not the current user)
  const otherMembers = useMemo(
    () => members.filter((m) => m.user_id !== currentUserId),
    [members, currentUserId],
  );

  const partner = useMemo(
    () => otherMembers.find((m) => m.user_id === partnerId) ?? null,
    [otherMembers, partnerId],
  );

  const partnerPicks = useMemo(
    () => allPicks.filter((p) => p.user_id === partnerId),
    [allPicks, partnerId],
  );

  const offeredPlayers  = myPicks.filter((p) => offeredIds.has(p.player_id));
  const requestedPlayers = partnerPicks.filter((p) => requestedIds.has(p.player_id));

  // Reset and close
  function handleClose() {
    setStep(0);
    setPartnerId('');
    setOfferedIds(new Set());
    setRequestedIds(new Set());
    setSubmitError(null);
    setSubmitting(false);
    onClose();
  }

  function toggleOffered(playerId: string) {
    setOfferedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function toggleRequested(playerId: string) {
    setRequestedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function handleSubmit() {
    if (offeredIds.size === 0 || requestedIds.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onPropose({
        receiver_id: partnerId,
        players_offered: Array.from(offeredIds),
        players_requested: Array.from(requestedIds),
      });
      handleClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to propose trade');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step content ──────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      // Step 0 – Select partner
      case 0:
        return (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Who do you want to trade with?</p>
            <div className="flex flex-col gap-2">
              {otherMembers.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-4">No other members in this room.</p>
              )}
              {otherMembers.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => setPartnerId(m.user_id)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150',
                    partnerId === m.user_id
                      ? 'bg-amber-500/15 border-amber-500/60'
                      : 'bg-slate-800/60 border-white/5 hover:border-white/15',
                  )}
                >
                  <Avatar src={m.user?.avatar_url} name={m.user?.display_name ?? m.team_name} size="sm" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-white truncate">
                      {m.user?.display_name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{m.team_name}</p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {allPicks.filter((p) => p.user_id === m.user_id).length} players
                  </span>
                  {partnerId === m.user_id && (
                    <div className="h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        );

      // Step 1 – Select players to offer
      case 1:
        return (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              Select players from your squad to offer to{' '}
              <span className="text-amber-400 font-semibold">
                {partner?.user?.display_name ?? partner?.team_name}
              </span>
              .
            </p>
            {myPicks.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-4">You have no players to offer.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
                {myPicks.map((pick) => (
                  <PlayerSelectRow
                    key={pick.id}
                    pick={pick}
                    selected={offeredIds.has(pick.player_id)}
                    onToggle={() => toggleOffered(pick.player_id)}
                  />
                ))}
              </div>
            )}
            {offeredIds.size > 0 && (
              <p className="text-xs text-amber-400 font-medium">
                {offeredIds.size} player{offeredIds.size !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        );

      // Step 2 – Select players to request
      case 2:
        return (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              Select players you want from{' '}
              <span className="text-amber-400 font-semibold">
                {partner?.user?.display_name ?? partner?.team_name}
              </span>
              's squad.
            </p>
            {partnerPicks.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-4">This member has no players.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
                {partnerPicks.map((pick) => (
                  <PlayerSelectRow
                    key={pick.id}
                    pick={pick}
                    selected={requestedIds.has(pick.player_id)}
                    onToggle={() => toggleRequested(pick.player_id)}
                  />
                ))}
              </div>
            )}
            {requestedIds.size > 0 && (
              <p className="text-xs text-amber-400 font-medium">
                {requestedIds.size} player{requestedIds.size !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        );

      // Step 3 – Review
      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Review your trade proposal before submitting.</p>

            <div className="grid grid-cols-2 gap-3">
              {/* Offering */}
              <div className="rounded-xl bg-slate-800/60 border border-white/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  You Offer
                </p>
                <div className="flex flex-col gap-1.5">
                  {offeredPlayers.map((pick) => (
                    <div key={pick.id} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
                      <span className="text-xs text-white truncate">{pick.player?.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Requesting */}
              <div className="rounded-xl bg-slate-800/60 border border-white/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  You Get
                </p>
                <div className="flex flex-col gap-1.5">
                  {requestedPlayers.map((pick) => (
                    <div key={pick.id} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
                      <span className="text-xs text-white truncate">{pick.player?.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Trade partner */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-white/5">
              <Avatar src={partner?.user?.avatar_url} name={partner?.user?.display_name ?? partner?.team_name} size="sm" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Trade with</p>
                <p className="text-sm font-semibold text-white">
                  {partner?.user?.display_name ?? partner?.team_name ?? 'Unknown'}
                </p>
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                {submitError}
              </p>
            )}
          </div>
        );
    }
  }

  // ── Nav buttons ───────────────────────────────────────────────────────────

  function canProceed(): boolean {
    if (step === 0) return !!partnerId;
    if (step === 1) return offeredIds.size > 0;
    if (step === 2) return requestedIds.size > 0;
    return true;
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Propose Trade" size="md">
      <StepBar current={step} />
      <div
        key={step}
        style={{ animation: 'modalSlideUp 180ms ease-out both' }}
      >
        {renderStep()}
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => step === 0 ? handleClose() : setStep((s) => (s - 1) as Step)}
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>

        {step < 3 ? (
          <Button
            size="sm"
            disabled={!canProceed()}
            onClick={() => setStep((s) => (s + 1) as Step)}
          >
            Next
          </Button>
        ) : (
          <Button
            size="sm"
            loading={submitting}
            disabled={offeredIds.size === 0 || requestedIds.size === 0}
            onClick={handleSubmit}
          >
            Propose Trade
          </Button>
        )}
      </div>
    </Modal>
  );
}

export default TradeModal;
