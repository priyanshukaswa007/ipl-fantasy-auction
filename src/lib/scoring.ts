import type { PlayerMatchStats } from '@/types';

export interface ScoringInput {
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

export function calculateFantasyPoints(input: ScoringInput): number {
  let points = 0;

  // --- Batting ---
  points += input.runs; // 1 per run
  points += input.fours * 1; // 1 bonus per 4
  points += input.sixes * 2; // 2 bonus per 6

  if (input.runs >= 100) {
    points += 50; // century bonus
  } else if (input.runs >= 50) {
    points += 25; // half-century bonus
  }

  if (input.runs >= 30) {
    points += 10; // 30+ milestone bonus
  }

  // Duck: 0 runs, only for batters/all-rounders (not tail-enders)
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
  points += input.wickets * 25; // 25 per wicket

  if (input.wickets >= 5) {
    points += 50; // 5-wicket bonus (additional)
  }
  if (input.wickets >= 3) {
    points += 25; // 3-wicket bonus (additional)
  }
  if (input.wickets >= 2) {
    points += 10; // 2-wicket bonus
  }

  points += input.maidens * 15; // 15 per maiden

  // Economy rate bonuses/penalties (per over bowled)
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

export function getPointsBreakdown(input: ScoringInput) {
  const breakdown: { label: string; points: number }[] = [];

  if (input.runs > 0) breakdown.push({ label: `${input.runs} runs`, points: input.runs });
  if (input.fours > 0) breakdown.push({ label: `${input.fours} fours`, points: input.fours });
  if (input.sixes > 0) breakdown.push({ label: `${input.sixes} sixes`, points: input.sixes * 2 });
  if (input.runs >= 100) breakdown.push({ label: 'Century', points: 50 });
  else if (input.runs >= 50) breakdown.push({ label: 'Half-century', points: 25 });
  if (input.runs >= 30 && input.runs < 50) breakdown.push({ label: '30+ runs', points: 10 });
  if (input.wickets > 0) breakdown.push({ label: `${input.wickets} wickets`, points: input.wickets * 25 });
  if (input.maidens > 0) breakdown.push({ label: `${input.maidens} maidens`, points: input.maidens * 15 });
  if (input.catches > 0) breakdown.push({ label: `${input.catches} catches`, points: input.catches * 10 });
  if (input.stumpings > 0) breakdown.push({ label: `${input.stumpings} stumpings`, points: input.stumpings * 15 });
  if (input.potm) breakdown.push({ label: 'Player of the Match', points: 25 });
  if (input.is_winner) breakdown.push({ label: 'Winning team', points: 15 });

  return breakdown;
}
