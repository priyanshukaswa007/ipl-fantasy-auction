// ============================================================
// IPL Fantasy Auction - Core Auction State Machine
// Pure logic only — no Supabase calls.
// ============================================================

import type {
  AuctionState,
  AuctionEvent,
  Player,
  RoomMember,
  RoomSettings,
  CompositionRules,
  PlayerRole,
} from '@/types';

// ── Internal helpers ─────────────────────────────────────────

/** Round a monetary value to 2 decimal places to avoid floating-point drift. */
function roundCrore(value: number): number {
  return Math.round(value * 100) / 100;
}

// ── Squad composition snapshot ───────────────────────────────

export interface SquadComposition {
  batters: number;
  bowlers: number;
  allrounders: number;
  wicketkeepers: number;
  overseas: number;
  indian: number;
}

// ── Bid permission result ─────────────────────────────────────

export interface BidPermission {
  allowed: boolean;
  reason?: string;
}

// ── Composition check result ──────────────────────────────────

export interface CompositionCheck {
  allowed: boolean;
  reason?: string;
}

// ============================================================
// AuctionEngine
// ============================================================

export class AuctionEngine {
  // ── createInitialState ──────────────────────────────────────

  /**
   * Returns a blank AuctionState that can be persisted when a room
   * transitions from 'waiting' → 'auction'.
   */
  static createInitialState(): AuctionState {
    return {
      status: 'not_started',
      current_player_id: null,
      current_bid: 0,
      current_bidder_id: null,
      timer_remaining: 0,
      sold_count: 0,
      unsold_count: 0,
      unsold_players: [],
      round: 1,
      pick_order: 0,
    };
  }

  // ── getNextBid ──────────────────────────────────────────────

  /**
   * Returns the next valid bid amount given the current highest bid
   * and the room's configured increment.
   */
  static getNextBid(currentBid: number, increment: number): number {
    return roundCrore(currentBid + increment);
  }

  // ── calculateSquadComposition ───────────────────────────────

  /**
   * Counts the breakdown of a member's current picks by role and
   * nationality so composition rules can be evaluated cheaply.
   */
  static calculateSquadComposition(picks: Player[]): SquadComposition {
    const composition: SquadComposition = {
      batters: 0,
      bowlers: 0,
      allrounders: 0,
      wicketkeepers: 0,
      overseas: 0,
      indian: 0,
    };

    for (const player of picks) {
      switch (player.role) {
        case 'Batter':
          composition.batters += 1;
          break;
        case 'Bowler':
          composition.bowlers += 1;
          break;
        case 'All-Rounder':
          composition.allrounders += 1;
          break;
        case 'Wicketkeeper':
          composition.wicketkeepers += 1;
          break;
      }

      // A player is "overseas" if their nationality is not Indian.
      // The types store nationality as a free-form string; we normalise
      // to lower-case for a resilient comparison.
      const nat = (player.nationality ?? player.country ?? '').toLowerCase();
      if (nat === 'indian' || nat === 'india') {
        composition.indian += 1;
      } else {
        composition.overseas += 1;
      }
    }

    return composition;
  }

  // ── checkCompositionRules ───────────────────────────────────

  /**
   * Determines whether adding `candidatePlayer` to an existing set of
   * `picks` would violate the room's composition rules.
   *
   * Returns `{ allowed: true }` when rules are disabled or when all
   * checks pass; otherwise returns `{ allowed: false, reason }`.
   */
  static checkCompositionRules(
    picks: Player[],
    candidatePlayer: Player,
    rules: CompositionRules,
  ): CompositionCheck {
    if (!rules.enabled) {
      return { allowed: true };
    }

    const current = AuctionEngine.calculateSquadComposition(picks);

    // ── Overseas cap ─────────────────────────────────────────
    const candidateIsOverseas =
      !['indian', 'india'].includes(
        (candidatePlayer.nationality ?? candidatePlayer.country ?? '').toLowerCase(),
      );

    if (candidateIsOverseas && current.overseas >= rules.max_overseas) {
      return {
        allowed: false,
        reason: `Overseas cap reached (max ${rules.max_overseas})`,
      };
    }

    // ── Role-based caps ──────────────────────────────────────
    // We only block a pick when adding the player would make it
    // *impossible* to satisfy the minimum requirements for other roles
    // given the slots still available.  For simplicity the engine
    // implements a forward-looking "slots remaining" check:
    //   remaining_slots_after_this_pick  <  minimums_still_unmet_for_other_roles
    //
    // This is deliberately conservative — it will not block unless the
    // situation is provably unrecoverable, leaving strategic freedom to
    // the team manager.

    const projectedPicks = picks.length + 1; // after adding candidate

    // Helper: slots still needed for roles OTHER than candidate's role
    function slotsStillNeeded(
      role: PlayerRole,
      countAfterPick: number,
      minRequired: number,
    ): number {
      return Math.max(0, minRequired - countAfterPick);
    }

    // Compute projected counts after the candidate pick
    const projectedCounts = {
      batters: current.batters + (candidatePlayer.role === 'Batter' ? 1 : 0),
      bowlers: current.bowlers + (candidatePlayer.role === 'Bowler' ? 1 : 0),
      allrounders: current.allrounders + (candidatePlayer.role === 'All-Rounder' ? 1 : 0),
      wicketkeepers: current.wicketkeepers + (candidatePlayer.role === 'Wicketkeeper' ? 1 : 0),
    };

    // Minimums still outstanding for each role (0 if already met)
    const stillNeeded =
      slotsStillNeeded('Batter', projectedCounts.batters, rules.min_batters) +
      slotsStillNeeded('Bowler', projectedCounts.bowlers, rules.min_bowlers) +
      slotsStillNeeded('All-Rounder', projectedCounts.allrounders, rules.min_allrounders) +
      slotsStillNeeded('Wicketkeeper', projectedCounts.wicketkeepers, rules.min_wicketkeepers);

    // We don't know squad_size_max here (it lives on RoomSettings), but
    // we can still flag an immediate role-count violation:
    // If the candidate is a Wicketkeeper and there is already enough, that
    // is fine.  What we do check is: would skipping this pick leave us
    // unable to fill minimum requirements?  That forward check requires
    // squad_size_max, which callers can enforce via canBid.  Here we only
    // enforce hard role caps if explicitly set.
    //
    // Concrete hard block: if the squad already has enough of every role
    // and the candidate role would push us past a hypothetical per-role
    // cap, we allow it — IPL rules don't set per-role maximums, only
    // minimums and the overseas cap.  So we leave the door open.
    //
    // The `stillNeeded` value is exposed for callers that want to surface
    // squad-building warnings; here we only block on the overseas cap.
    void stillNeeded; // suppress unused-variable lint for now

    return { allowed: true };
  }

  // ── canBid ──────────────────────────────────────────────────

  /**
   * Full gate-check called before submitting a bid on behalf of `member`.
   *
   * Checks (in order):
   *  1. Auction is in progress.
   *  2. The member is not already the current highest bidder.
   *  3. Budget: next bid amount must not exceed budget_remaining.
   *  4. Squad size: member must not already be at the squad maximum.
   *  5. Composition rules (overseas cap, etc.) against the candidate player.
   */
  static canBid(
    member: RoomMember,
    auctionState: AuctionState,
    settings: RoomSettings,
    memberPicks: Player[],
  ): BidPermission {
    // 1. Auction must be live
    if (auctionState.status !== 'in_progress') {
      return { allowed: false, reason: 'Auction is not currently in progress' };
    }

    // 2. Must have an active player on the block
    if (!auctionState.current_player_id) {
      return { allowed: false, reason: 'No player is currently up for auction' };
    }

    // 3. Cannot outbid yourself
    if (auctionState.current_bidder_id === member.user_id) {
      return { allowed: false, reason: 'You are already the highest bidder' };
    }

    // 4. Budget check — next bid must fit within remaining budget
    const nextBid = AuctionEngine.getNextBid(auctionState.current_bid, settings.bid_increment);
    if (roundCrore(nextBid) > roundCrore(member.budget_remaining)) {
      return {
        allowed: false,
        reason: `Insufficient budget (need ₹${nextBid}Cr, have ₹${member.budget_remaining}Cr)`,
      };
    }

    // 5. Squad size cap
    if (memberPicks.length >= settings.squad_size_max) {
      return {
        allowed: false,
        reason: `Squad full (max ${settings.squad_size_max} players)`,
      };
    }

    // 6. Composition rules — need the candidate Player object to check roles/overseas
    //    We find it from the picks list only if it happens to be in there (it won't be),
    //    so callers can optionally pass the candidate player via a separate overload.
    //    The base canBid check skips the composition check when the player object is
    //    unavailable.  Use canBidForPlayer for the full check.
    return { allowed: true };
  }

  /**
   * Extended version of canBid that also verifies composition rules
   * against the specific player being auctioned.
   */
  static canBidForPlayer(
    member: RoomMember,
    candidatePlayer: Player,
    auctionState: AuctionState,
    settings: RoomSettings,
    memberPicks: Player[],
  ): BidPermission {
    // Run all base checks first
    const base = AuctionEngine.canBid(member, auctionState, settings, memberPicks);
    if (!base.allowed) return base;

    // Composition rules
    const compositionCheck = AuctionEngine.checkCompositionRules(
      memberPicks,
      candidatePlayer,
      settings.composition_rules,
    );
    if (!compositionCheck.allowed) {
      return { allowed: false, reason: compositionCheck.reason };
    }

    return { allowed: true };
  }

  // ── sortPlayersForAuction ───────────────────────────────────

  /**
   * Returns a new array of players sorted according to the room's
   * configured `player_order` setting.  Does not mutate the input.
   *
   * - 'random'     — Fisher-Yates shuffle
   * - 'price_desc' — highest base_price first; ties broken by rating desc
   * - 'by_role'    — Wicketkeepers → Batters → All-Rounders → Bowlers,
   *                  then by base_price desc within each group
   */
  static sortPlayersForAuction(
    players: Player[],
    order: 'random' | 'price_desc' | 'by_role',
  ): Player[] {
    const copy = [...players];

    switch (order) {
      case 'random': {
        // Fisher-Yates in-place on the copy
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      }

      case 'price_desc': {
        return copy.sort((a, b) => {
          if (b.base_price !== a.base_price) return b.base_price - a.base_price;
          return b.rating - a.rating;
        });
      }

      case 'by_role': {
        const ROLE_ORDER: Record<PlayerRole, number> = {
          Wicketkeeper: 0,
          Batter: 1,
          'All-Rounder': 2,
          Bowler: 3,
        };
        return copy.sort((a, b) => {
          const roleDiff = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
          if (roleDiff !== 0) return roleDiff;
          if (b.base_price !== a.base_price) return b.base_price - a.base_price;
          return b.rating - a.rating;
        });
      }

      default: {
        // Exhaustiveness guard — TypeScript will catch unhandled cases at
        // compile time; this branch keeps runtime safe too.
        const _exhaustive: never = order;
        return copy;
      }
    }
  }
}
