// ============================================================
// API Route: POST /api/scores/update
// Fetches a match scorecard from CricAPI, calculates fantasy
// points, and updates the database + leaderboard.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getMatchScorecard,
  getMatchInfo,
  mapTeamName,
  findPlayerMatch,
  type CricAPIScorecard,
  type CricAPIScorecardBatsman,
  type CricAPIScorecardBowler,
} from '@/lib/cricapi';
import { calculateFantasyPoints } from '@/lib/scoring';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Player performance aggregator ────────────────────────────

interface PlayerPerformance {
  playerName: string;
  team: string;
  runs: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  wickets: number;
  overs_bowled: number;
  runs_conceded: number;
  maidens: number;
  catches: number;
  stumpings: number;
  run_outs_direct: number;
  run_outs_indirect: number;
  potm: boolean;
  did_not_bat: boolean;
  is_winner: boolean;
}

function createEmptyPerformance(name: string, team: string): PlayerPerformance {
  return {
    playerName: name,
    team,
    runs: 0,
    balls_faced: 0,
    fours: 0,
    sixes: 0,
    wickets: 0,
    overs_bowled: 0,
    runs_conceded: 0,
    maidens: 0,
    catches: 0,
    stumpings: 0,
    run_outs_direct: 0,
    run_outs_indirect: 0,
    potm: false,
    did_not_bat: true,
    is_winner: false,
  };
}

// ── Parse scorecard into player performances ─────────────────

function parseScorecardToPerformances(
  scorecard: CricAPIScorecard
): Map<string, PlayerPerformance> {
  const performances = new Map<string, PlayerPerformance>();
  const winnerTeam = scorecard.matchWinner || '';
  const motmName = scorecard.manOfTheMatch?.name || '';

  for (const inning of scorecard.scorecard || []) {
    // Determine the team batting in this inning
    const inningTeam = inning.inning?.split(' ')?.[0] || '';
    const teamAbbr = mapTeamName(inningTeam);

    // Parse batting
    const batsmen = inning.batting || inning.battingOrder || [];
    for (const bat of batsmen) {
      const name = bat.batsman?.name || '';
      if (!name) continue;

      const key = name.toLowerCase();
      if (!performances.has(key)) {
        performances.set(key, createEmptyPerformance(name, teamAbbr));
      }
      const perf = performances.get(key)!;

      perf.did_not_bat = false;
      perf.runs = (bat['runs-scored'] ?? bat.r ?? 0);
      perf.balls_faced = bat.b ?? 0;
      perf.fours = bat['4s'] ?? 0;
      perf.sixes = bat['6s'] ?? 0;

      // Check if on winning team
      if (winnerTeam && inningTeam.toLowerCase().includes(winnerTeam.toLowerCase().split(' ')[0])) {
        perf.is_winner = true;
      }

      // Check POTM
      if (motmName && name.toLowerCase().includes(motmName.toLowerCase().split(' ').pop()!)) {
        perf.potm = true;
      }
    }

    // Parse bowling
    const bowlers = inning.bowling || inning.bowlingOrder || [];
    for (const bowl of bowlers) {
      const name = bowl.bowler?.name || '';
      if (!name) continue;

      const key = name.toLowerCase();
      if (!performances.has(key)) {
        // Bowler's team is the OTHER team (they bowl against the batting team)
        performances.set(key, createEmptyPerformance(name, ''));
      }
      const perf = performances.get(key)!;

      perf.overs_bowled = bowl.o ?? 0;
      perf.maidens = bowl.m ?? 0;
      perf.runs_conceded = bowl.r ?? 0;
      perf.wickets = bowl.w ?? 0;
    }

    // Parse fielding
    if (inning.fielding) {
      for (const field of inning.fielding) {
        const name = field.fielder?.name || '';
        if (!name) continue;

        const key = name.toLowerCase();
        if (!performances.has(key)) {
          performances.set(key, createEmptyPerformance(name, ''));
        }
        const perf = performances.get(key)!;

        perf.catches += field.catches ?? 0;
        perf.stumpings += field.stumpings ?? 0;
        perf.run_outs_direct += field.runouts ?? 0;
      }
    }
  }

  // Set winner flag for all players on winning team
  if (winnerTeam) {
    const winnerAbbr = mapTeamName(winnerTeam);
    for (const perf of performances.values()) {
      if (perf.team === winnerAbbr) {
        perf.is_winner = true;
      }
    }
  }

  // Set POTM
  if (motmName) {
    for (const [key, perf] of performances.entries()) {
      if (key.includes(motmName.toLowerCase().split(' ').pop()!)) {
        perf.potm = true;
      }
    }
  }

  return performances;
}

// ── Main handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { match_id, match_number } = body;

    if (!match_id) {
      return NextResponse.json({ error: 'match_id is required' }, { status: 400 });
    }

    console.log(`[Scores] Processing match: ${match_id}`);

    // 1. Fetch scorecard from CricAPI
    const scorecard = await getMatchScorecard(match_id);

    if (!scorecard || !scorecard.scorecard?.length) {
      return NextResponse.json({ error: 'No scorecard data available yet' }, { status: 404 });
    }

    console.log(`[Scores] Match: ${scorecard.name}, Status: ${scorecard.status}`);

    // 2. Parse scorecard into player performances
    const performances = parseScorecardToPerformances(scorecard);
    console.log(`[Scores] Found ${performances.size} player performances`);

    // 3. Determine teams
    const teamA = mapTeamName(scorecard.teams?.[0] || '');
    const teamB = mapTeamName(scorecard.teams?.[1] || '');
    const winner = scorecard.matchWinner ? mapTeamName(scorecard.matchWinner) : null;

    // 4. Create or update match_results
    const matchNum = match_number || 0;
    const { data: matchResult, error: matchError } = await supabase
      .from('match_results')
      .upsert(
        {
          match_number: matchNum,
          team_a: teamA,
          team_b: teamB,
          winner,
          date: scorecard.date || new Date().toISOString().split('T')[0],
          venue: scorecard.venue || '',
          season: 'IPL 2026',
        },
        { onConflict: 'match_number,season' }
      )
      .select()
      .single();

    if (matchError) {
      console.error('[Scores] Match insert error:', matchError);
      return NextResponse.json({ error: matchError.message }, { status: 500 });
    }

    console.log(`[Scores] Match result saved: ${teamA} vs ${teamB}, winner: ${winner}`);

    // 5. Get all players from our database for fuzzy matching
    const { data: dbPlayers } = await supabase
      .from('players')
      .select('id, name, team')
      .eq('season', 'IPL 2026');

    if (!dbPlayers?.length) {
      return NextResponse.json({ error: 'No players in database' }, { status: 500 });
    }

    // 6. Match performances to DB players and calculate fantasy points
    const stats: Array<Record<string, unknown>> = [];
    const unmatchedPlayers: string[] = [];
    let totalPointsCalculated = 0;

    for (const [, perf] of performances) {
      const dbPlayer = findPlayerMatch(perf.playerName, dbPlayers);

      if (!dbPlayer) {
        unmatchedPlayers.push(perf.playerName);
        continue;
      }

      const fantasyPoints = calculateFantasyPoints({
        runs: perf.runs,
        balls_faced: perf.balls_faced,
        fours: perf.fours,
        sixes: perf.sixes,
        wickets: perf.wickets,
        overs_bowled: perf.overs_bowled,
        runs_conceded: perf.runs_conceded,
        maidens: perf.maidens,
        catches: perf.catches,
        stumpings: perf.stumpings,
        run_outs_direct: perf.run_outs_direct,
        run_outs_indirect: perf.run_outs_indirect,
        potm: perf.potm,
        did_not_bat: perf.did_not_bat,
        is_winner: perf.is_winner,
        role: '',
      });

      totalPointsCalculated += fantasyPoints;

      stats.push({
        player_id: dbPlayer.id,
        match_id: matchResult.id,
        runs: perf.runs,
        balls_faced: perf.balls_faced,
        fours: perf.fours,
        sixes: perf.sixes,
        wickets: perf.wickets,
        overs_bowled: perf.overs_bowled,
        runs_conceded: perf.runs_conceded,
        maidens: perf.maidens,
        catches: perf.catches,
        stumpings: perf.stumpings,
        run_outs_direct: perf.run_outs_direct,
        run_outs_indirect: perf.run_outs_indirect,
        potm: perf.potm,
        did_not_bat: perf.did_not_bat,
        is_winner: perf.is_winner,
        fantasy_points: fantasyPoints,
      });
    }

    // 7. Upsert player_match_stats
    if (stats.length > 0) {
      const { error: statsError } = await supabase
        .from('player_match_stats')
        .upsert(stats, { onConflict: 'player_id,match_id' });

      if (statsError) {
        console.error('[Scores] Stats insert error:', statsError);
        return NextResponse.json({ error: statsError.message }, { status: 500 });
      }
    }

    console.log(`[Scores] Saved ${stats.length} player stats, ${unmatchedPlayers.length} unmatched`);

    // 8. Update leaderboard for ALL active rooms
    const { data: activeRooms } = await supabase
      .from('rooms')
      .select('id')
      .eq('status', 'active');

    let leaderboardsUpdated = 0;

    for (const room of activeRooms || []) {
      // Get all picks for this room
      const { data: picks } = await supabase
        .from('auction_picks')
        .select('user_id, player_id')
        .eq('room_id', room.id);

      if (!picks?.length) continue;

      // Group picks by user
      const userPlayers = new Map<string, string[]>();
      for (const pick of picks) {
        if (!userPlayers.has(pick.user_id)) {
          userPlayers.set(pick.user_id, []);
        }
        userPlayers.get(pick.user_id)!.push(pick.player_id);
      }

      // Calculate total + last match points per user
      for (const [userId, playerIds] of userPlayers) {
        // Total points across ALL matches
        const { data: totalData } = await supabase
          .from('player_match_stats')
          .select('fantasy_points')
          .in('player_id', playerIds);

        const totalPoints = totalData?.reduce((sum, s) => sum + (s.fantasy_points || 0), 0) || 0;

        // Points from THIS match only
        const { data: lastMatchData } = await supabase
          .from('player_match_stats')
          .select('fantasy_points')
          .in('player_id', playerIds)
          .eq('match_id', matchResult.id);

        const lastMatchPoints = lastMatchData?.reduce((sum, s) => sum + (s.fantasy_points || 0), 0) || 0;

        // Upsert leaderboard
        await supabase.from('leaderboard_cache').upsert(
          {
            room_id: room.id,
            user_id: userId,
            total_points: totalPoints,
            last_match_points: lastMatchPoints,
            rank: 0, // Will be calculated below
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'room_id,user_id' }
        );
      }

      // Recalculate ranks for this room
      const { data: leaderboard } = await supabase
        .from('leaderboard_cache')
        .select('*')
        .eq('room_id', room.id)
        .order('total_points', { ascending: false });

      if (leaderboard) {
        for (let i = 0; i < leaderboard.length; i++) {
          await supabase
            .from('leaderboard_cache')
            .update({ rank: i + 1 })
            .eq('room_id', room.id)
            .eq('user_id', leaderboard[i].user_id);
        }
      }

      leaderboardsUpdated++;
    }

    console.log(`[Scores] Updated ${leaderboardsUpdated} room leaderboards`);

    return NextResponse.json({
      success: true,
      match: `${teamA} vs ${teamB}`,
      winner,
      players_processed: stats.length,
      unmatched_players: unmatchedPlayers,
      total_fantasy_points: totalPointsCalculated,
      leaderboards_updated: leaderboardsUpdated,
    });
  } catch (error: any) {
    console.error('[Scores] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process match' },
      { status: 500 }
    );
  }
}
