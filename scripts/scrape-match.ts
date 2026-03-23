import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Supabase client
// ============================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================
// Scoring logic (replicated from src/lib/scoring.ts)
// ============================================================
interface ScoringInput {
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
  role: string;
  batting_position?: number;
}

interface PointsBreakdownItem {
  label: string;
  points: number;
}

function calculateFantasyPoints(input: ScoringInput): number {
  let points = 0;

  // --- Batting ---
  points += input.runs;
  points += input.fours * 1;
  points += input.sixes * 2;

  if (input.runs >= 100) {
    points += 50;
  } else if (input.runs >= 50) {
    points += 25;
  }

  if (input.runs >= 30) {
    points += 10;
  }

  const isTailEnder = (input.batting_position ?? 0) >= 10;
  if (
    input.runs === 0 &&
    !input.did_not_bat &&
    input.balls_faced > 0 &&
    !isTailEnder
  ) {
    points -= 5;
  }

  // --- Bowling ---
  points += input.wickets * 25;

  if (input.wickets >= 5) {
    points += 50;
  }
  if (input.wickets >= 3) {
    points += 25;
  }
  if (input.wickets >= 2) {
    points += 10;
  }

  points += input.maidens * 15;

  if (input.overs_bowled > 0) {
    const economy = input.runs_conceded / input.overs_bowled;
    if (economy > 12) {
      points -= Math.floor(input.overs_bowled) * 5;
    } else if (economy < 6) {
      points += Math.floor(input.overs_bowled) * 5;
    }
  }

  // --- Fielding ---
  points += input.catches * 10;
  points += input.stumpings * 15;
  points += input.run_outs_direct * 10;
  points += input.run_outs_indirect * 5;

  // --- Bonuses ---
  if (input.potm) points += 25;
  if (input.is_winner) points += 15;

  return points;
}

function getPointsBreakdown(input: ScoringInput): PointsBreakdownItem[] {
  const breakdown: PointsBreakdownItem[] = [];

  if (input.runs > 0) breakdown.push({ label: `${input.runs} runs`, points: input.runs });
  if (input.fours > 0) breakdown.push({ label: `${input.fours} fours (bonus)`, points: input.fours });
  if (input.sixes > 0) breakdown.push({ label: `${input.sixes} sixes (bonus)`, points: input.sixes * 2 });
  if (input.runs >= 100) breakdown.push({ label: 'Century bonus', points: 50 });
  else if (input.runs >= 50) breakdown.push({ label: 'Half-century bonus', points: 25 });
  if (input.runs >= 30) breakdown.push({ label: '30+ bonus', points: 10 });

  const isTailEnder = (input.batting_position ?? 0) >= 10;
  if (input.runs === 0 && !input.did_not_bat && input.balls_faced > 0 && !isTailEnder) {
    breakdown.push({ label: 'Duck penalty', points: -5 });
  }

  if (input.wickets > 0) breakdown.push({ label: `${input.wickets} wickets`, points: input.wickets * 25 });
  if (input.wickets >= 5) breakdown.push({ label: '5-wicket haul bonus', points: 50 });
  if (input.wickets >= 3) breakdown.push({ label: '3-wicket bonus', points: 25 });
  if (input.wickets >= 2) breakdown.push({ label: '2-wicket bonus', points: 10 });
  if (input.maidens > 0) breakdown.push({ label: `${input.maidens} maidens`, points: input.maidens * 15 });

  if (input.overs_bowled > 0) {
    const economy = input.runs_conceded / input.overs_bowled;
    if (economy > 12) {
      breakdown.push({ label: `Economy penalty (${economy.toFixed(2)})`, points: -Math.floor(input.overs_bowled) * 5 });
    } else if (economy < 6) {
      breakdown.push({ label: `Economy bonus (${economy.toFixed(2)})`, points: Math.floor(input.overs_bowled) * 5 });
    }
  }

  if (input.catches > 0) breakdown.push({ label: `${input.catches} catches`, points: input.catches * 10 });
  if (input.stumpings > 0) breakdown.push({ label: `${input.stumpings} stumpings`, points: input.stumpings * 15 });
  if (input.run_outs_direct > 0) breakdown.push({ label: `${input.run_outs_direct} direct run-outs`, points: input.run_outs_direct * 10 });
  if (input.run_outs_indirect > 0) breakdown.push({ label: `${input.run_outs_indirect} indirect run-outs`, points: input.run_outs_indirect * 5 });
  if (input.potm) breakdown.push({ label: 'Player of the Match', points: 25 });
  if (input.is_winner) breakdown.push({ label: 'Winning team', points: 15 });

  return breakdown;
}

// ============================================================
// Types for match data input
// ============================================================
interface PlayerPerformance {
  name: string;
  team: string;
  runs?: number;
  balls_faced?: number;
  fours?: number;
  sixes?: number;
  wickets?: number;
  overs_bowled?: number;
  runs_conceded?: number;
  maidens?: number;
  catches?: number;
  stumpings?: number;
  run_outs_direct?: number;
  run_outs_indirect?: number;
  potm?: boolean;
  did_not_bat?: boolean;
  batting_position?: number;
}

interface MatchData {
  team_a: string;
  team_b: string;
  winner: string | null;
  date: string;           // YYYY-MM-DD
  venue: string;
  season?: string;
  innings: PlayerPerformance[];
}

// ============================================================
// Main processing function
// ============================================================
async function processMatchData(matchNumber: number, matchData: MatchData): Promise<void> {
  const season = matchData.season ?? 'IPL 2025';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing Match #${matchNumber}`);
  console.log(`${matchData.team_a} vs ${matchData.team_b}`);
  console.log(`Date: ${matchData.date}  Venue: ${matchData.venue}`);
  console.log(`Winner: ${matchData.winner ?? 'No result'}`);
  console.log(`Season: ${season}`);
  console.log(`${'='.repeat(60)}`);

  // ----------------------------------------------------------
  // 1. Upsert match_results
  // ----------------------------------------------------------
  console.log(`\n[1/4] Upserting match result...`);

  const { data: matchResult, error: matchError } = await supabase
    .from('match_results')
    .upsert(
      {
        match_number: matchNumber,
        team_a: matchData.team_a,
        team_b: matchData.team_b,
        winner: matchData.winner,
        date: matchData.date,
        venue: matchData.venue,
        season,
      },
      { onConflict: 'match_number,season' }
    )
    .select()
    .single();

  if (matchError) {
    console.error(`  ERROR upserting match: ${matchError.message}`);
    throw matchError;
  }

  const matchId = matchResult.id;
  console.log(`  OK — match_id: ${matchId}`);

  // ----------------------------------------------------------
  // 2. Resolve player IDs
  // ----------------------------------------------------------
  console.log(`\n[2/4] Resolving player IDs from database...`);

  const playerNames = [...new Set(matchData.innings.map((p) => p.name))];
  const { data: dbPlayers, error: playerFetchError } = await supabase
    .from('players')
    .select('id, name, team, role')
    .in('name', playerNames)
    .eq('season', season);

  if (playerFetchError) {
    console.error(`  ERROR fetching players: ${playerFetchError.message}`);
    throw playerFetchError;
  }

  // Build lookup: "name|team" -> player record
  const playerMap = new Map<string, { id: string; name: string; team: string; role: string }>();
  for (const pl of dbPlayers ?? []) {
    playerMap.set(`${pl.name}|${pl.team}`, pl);
    // Also index by name alone as fallback
    if (!playerMap.has(pl.name)) {
      playerMap.set(pl.name, pl);
    }
  }

  console.log(`  Resolved ${playerMap.size} unique player entries for ${playerNames.length} names`);

  // ----------------------------------------------------------
  // 3. Calculate fantasy points & build player_match_stats rows
  // ----------------------------------------------------------
  console.log(`\n[3/4] Calculating fantasy points...\n`);

  const statsRows: Array<{
    player_id: string;
    match_id: string;
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
    fantasy_points: number;
  }> = [];

  let skipped = 0;

  for (const perf of matchData.innings) {
    const is_winner =
      matchData.winner !== null &&
      (perf.team === matchData.winner || perf.team === matchData.winner);

    // Try "name|team" first, then name-only fallback
    const playerKey = `${perf.name}|${perf.team}`;
    const player = playerMap.get(playerKey) ?? playerMap.get(perf.name);

    if (!player) {
      console.warn(`  SKIP — Player not found in DB: "${perf.name}" (team: ${perf.team})`);
      skipped++;
      continue;
    }

    const scoringInput: ScoringInput = {
      runs: perf.runs ?? 0,
      balls_faced: perf.balls_faced ?? 0,
      fours: perf.fours ?? 0,
      sixes: perf.sixes ?? 0,
      wickets: perf.wickets ?? 0,
      overs_bowled: perf.overs_bowled ?? 0,
      runs_conceded: perf.runs_conceded ?? 0,
      maidens: perf.maidens ?? 0,
      catches: perf.catches ?? 0,
      stumpings: perf.stumpings ?? 0,
      run_outs_direct: perf.run_outs_direct ?? 0,
      run_outs_indirect: perf.run_outs_indirect ?? 0,
      potm: perf.potm ?? false,
      did_not_bat: perf.did_not_bat ?? false,
      is_winner,
      role: player.role,
      batting_position: perf.batting_position,
    };

    const fantasy_points = calculateFantasyPoints(scoringInput);
    const breakdown = getPointsBreakdown(scoringInput);

    console.log(`  ${perf.name} (${perf.team}) — ${fantasy_points} pts`);
    for (const b of breakdown) {
      const sign = b.points >= 0 ? '+' : '';
      console.log(`    ${sign}${b.points}  ${b.label}`);
    }

    statsRows.push({
      player_id: player.id,
      match_id: matchId,
      runs: scoringInput.runs,
      balls_faced: scoringInput.balls_faced,
      fours: scoringInput.fours,
      sixes: scoringInput.sixes,
      wickets: scoringInput.wickets,
      overs_bowled: scoringInput.overs_bowled,
      runs_conceded: scoringInput.runs_conceded,
      maidens: scoringInput.maidens,
      catches: scoringInput.catches,
      stumpings: scoringInput.stumpings,
      run_outs_direct: scoringInput.run_outs_direct,
      run_outs_indirect: scoringInput.run_outs_indirect,
      potm: scoringInput.potm,
      did_not_bat: scoringInput.did_not_bat,
      is_winner,
      fantasy_points,
    });
  }

  console.log(`\n  Processed: ${statsRows.length}  Skipped: ${skipped}`);

  // ----------------------------------------------------------
  // Upsert player_match_stats
  // ----------------------------------------------------------
  if (statsRows.length > 0) {
    const { error: statsError } = await supabase
      .from('player_match_stats')
      .upsert(statsRows, { onConflict: 'player_id,match_id' });

    if (statsError) {
      console.error(`  ERROR upserting player_match_stats: ${statsError.message}`);
      throw statsError;
    }
    console.log(`  Upserted ${statsRows.length} player_match_stats rows`);
  }

  // ----------------------------------------------------------
  // 4. Update leaderboard_cache for all active rooms
  // ----------------------------------------------------------
  console.log(`\n[4/4] Updating leaderboard_cache for active rooms...`);

  const { data: activeRooms, error: roomsError } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('status', 'active');

  if (roomsError) {
    console.error(`  ERROR fetching active rooms: ${roomsError.message}`);
    throw roomsError;
  }

  if (!activeRooms || activeRooms.length === 0) {
    console.log(`  No active rooms found — skipping leaderboard update`);
    return;
  }

  console.log(`  Found ${activeRooms.length} active room(s)`);

  for (const room of activeRooms) {
    console.log(`\n  Room: "${room.name}" (${room.id})`);

    // Get all members in the room
    const { data: members, error: membersError } = await supabase
      .from('room_members')
      .select('user_id')
      .eq('room_id', room.id);

    if (membersError) {
      console.error(`    ERROR fetching members: ${membersError.message}`);
      continue;
    }

    if (!members || members.length === 0) {
      console.log(`    No members — skipping`);
      continue;
    }

    // For each member, compute their total fantasy points across all matches
    const leaderboardUpdates: Array<{
      room_id: string;
      user_id: string;
      total_points: number;
      last_match_points: number;
      rank: number;
      updated_at: string;
    }> = [];

    for (const member of members) {
      // Get all player IDs owned by this member in this room
      const { data: picks, error: picksError } = await supabase
        .from('auction_picks')
        .select('player_id')
        .eq('room_id', room.id)
        .eq('user_id', member.user_id);

      if (picksError) {
        console.error(`    ERROR fetching picks for user ${member.user_id}: ${picksError.message}`);
        continue;
      }

      if (!picks || picks.length === 0) {
        leaderboardUpdates.push({
          room_id: room.id,
          user_id: member.user_id,
          total_points: 0,
          last_match_points: 0,
          rank: 0,
          updated_at: new Date().toISOString(),
        });
        continue;
      }

      const playerIds = picks.map((pk) => pk.player_id);

      // Total points across all matches
      const { data: allStats, error: allStatsError } = await supabase
        .from('player_match_stats')
        .select('fantasy_points, match_id')
        .in('player_id', playerIds);

      if (allStatsError) {
        console.error(`    ERROR fetching all stats: ${allStatsError.message}`);
        continue;
      }

      const total_points = (allStats ?? []).reduce((sum, s) => sum + (s.fantasy_points ?? 0), 0);

      // Last match points (only stats from this match)
      const last_match_points = (allStats ?? [])
        .filter((s) => s.match_id === matchId)
        .reduce((sum, s) => sum + (s.fantasy_points ?? 0), 0);

      leaderboardUpdates.push({
        room_id: room.id,
        user_id: member.user_id,
        total_points,
        last_match_points,
        rank: 0, // will be assigned below
        updated_at: new Date().toISOString(),
      });
    }

    // Assign ranks by total_points descending
    leaderboardUpdates.sort((a, b) => b.total_points - a.total_points);
    let currentRank = 1;
    for (let i = 0; i < leaderboardUpdates.length; i++) {
      if (i > 0 && leaderboardUpdates[i].total_points < leaderboardUpdates[i - 1].total_points) {
        currentRank = i + 1;
      }
      leaderboardUpdates[i].rank = currentRank;
    }

    const { error: lbError } = await supabase
      .from('leaderboard_cache')
      .upsert(leaderboardUpdates, { onConflict: 'room_id,user_id' });

    if (lbError) {
      console.error(`    ERROR upserting leaderboard: ${lbError.message}`);
      continue;
    }

    console.log(`    Updated leaderboard for ${leaderboardUpdates.length} member(s):`);
    for (const entry of leaderboardUpdates) {
      console.log(`      Rank ${entry.rank}  user:${entry.user_id.slice(0, 8)}...  total:${entry.total_points}  last:${entry.last_match_points}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Match #${matchNumber} processing complete!`);
  console.log(`${'='.repeat(60)}\n`);
}

// ============================================================
// CLI entry point
// ============================================================
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/scrape-match.ts <match_number>');
    console.error('Example: npx tsx scripts/scrape-match.ts 1');
    console.error('\nReads match data from: scripts/match-data/match-<number>.json');
    process.exit(1);
  }

  const matchNumber = parseInt(args[0], 10);
  if (isNaN(matchNumber) || matchNumber < 1) {
    console.error(`Invalid match number: "${args[0]}". Must be a positive integer.`);
    process.exit(1);
  }

  // Locate JSON file
  const jsonPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
    'match-data',
    `match-${matchNumber}.json`
  );

  console.log(`Looking for match data at: ${jsonPath}`);

  if (!fs.existsSync(jsonPath)) {
    console.error(`\nFile not found: ${jsonPath}`);
    console.error(`\nCreate the file with this structure:`);
    console.error(JSON.stringify(EXAMPLE_MATCH_DATA, null, 2));
    process.exit(1);
  }

  let matchData: MatchData;
  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    matchData = JSON.parse(raw) as MatchData;
  } catch (err) {
    console.error(`Failed to parse JSON from ${jsonPath}:`, err);
    process.exit(1);
  }

  // Basic validation
  const requiredFields: (keyof MatchData)[] = ['team_a', 'team_b', 'date', 'venue', 'innings'];
  for (const field of requiredFields) {
    if (!(field in matchData)) {
      console.error(`Missing required field "${field}" in match JSON.`);
      process.exit(1);
    }
  }

  if (!Array.isArray(matchData.innings)) {
    console.error(`"innings" must be an array of player performances.`);
    process.exit(1);
  }

  await processMatchData(matchNumber, matchData);
}

// ============================================================
// Example match data (shown when file is missing)
// ============================================================
const EXAMPLE_MATCH_DATA: MatchData = {
  team_a: 'CSK',
  team_b: 'MI',
  winner: 'CSK',
  date: '2025-03-22',
  venue: 'MA Chidambaram Stadium, Chennai',
  season: 'IPL 2025',
  innings: [
    {
      name: 'Ruturaj Gaikwad',
      team: 'CSK',
      runs: 72,
      balls_faced: 48,
      fours: 7,
      sixes: 2,
      wickets: 0,
      overs_bowled: 0,
      runs_conceded: 0,
      maidens: 0,
      catches: 1,
      stumpings: 0,
      run_outs_direct: 0,
      run_outs_indirect: 0,
      potm: true,
      did_not_bat: false,
      batting_position: 1,
    },
    {
      name: 'Matheesha Pathirana',
      team: 'CSK',
      runs: 0,
      balls_faced: 0,
      fours: 0,
      sixes: 0,
      wickets: 3,
      overs_bowled: 4,
      runs_conceded: 22,
      maidens: 1,
      catches: 0,
      stumpings: 0,
      run_outs_direct: 0,
      run_outs_indirect: 0,
      potm: false,
      did_not_bat: true,
      batting_position: 11,
    },
    {
      name: 'Rohit Sharma',
      team: 'MI',
      runs: 45,
      balls_faced: 32,
      fours: 4,
      sixes: 2,
      wickets: 0,
      overs_bowled: 0,
      runs_conceded: 0,
      maidens: 0,
      catches: 0,
      stumpings: 0,
      run_outs_direct: 0,
      run_outs_indirect: 0,
      potm: false,
      did_not_bat: false,
      batting_position: 1,
    },
    {
      name: 'Jasprit Bumrah',
      team: 'MI',
      runs: 0,
      balls_faced: 2,
      fours: 0,
      sixes: 0,
      wickets: 2,
      overs_bowled: 4,
      runs_conceded: 28,
      maidens: 0,
      catches: 0,
      stumpings: 0,
      run_outs_direct: 0,
      run_outs_indirect: 0,
      potm: false,
      did_not_bat: false,
      batting_position: 11,
    },
  ],
};

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
