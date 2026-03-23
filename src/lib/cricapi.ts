// ============================================================
// CricAPI Integration — Auto-fetch IPL match scorecards
// Free tier: 100 API calls/day at https://cricketdata.org
// ============================================================

const CRICAPI_BASE = 'https://api.cricapi.com/v1';

function getApiKey(): string {
  const key = process.env.CRICAPI_KEY;
  if (!key || key === 'your_cricapi_key_here') {
    throw new Error('CRICAPI_KEY not set. Sign up free at https://cricketdata.org');
  }
  return key;
}

// ── Types for CricAPI responses ──────────────────────────────

export interface CricAPIMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  teamInfo: Array<{
    name: string;
    shortname: string;
    img: string;
  }>;
  score: Array<{
    r: number;
    w: number;
    o: number;
    inning: string;
  }>;
  series_id: string;
  fantasyEnabled: boolean;
  bbbEnabled: boolean;
  hasSquad: boolean;
  matchStarted: boolean;
  matchEnded: boolean;
}

export interface CricAPIScorecardBatsman {
  batsman: { id: string; name: string };
  'runs-scored'?: number;
  r?: number;
  b?: number;
  '4s'?: number;
  '6s'?: number;
  sr?: string;
  dismissal?: string;
  'dismissal-text'?: string;
}

export interface CricAPIScorecardBowler {
  bowler: { id: string; name: string };
  o?: number;
  m?: number;
  r?: number;
  w?: number;
  eco?: string;
  nb?: number;
  wd?: number;
}

export interface CricAPIScorecardInning {
  inning: string;
  battingOrder?: CricAPIScorecardBatsman[];
  batting?: CricAPIScorecardBatsman[];
  bowlingOrder?: CricAPIScorecardBowler[];
  bowling?: CricAPIScorecardBowler[];
  fielding?: {
    fielder: { id: string; name: string };
    catches?: number;
    stumpings?: number;
    runouts?: number;
  }[];
}

export interface CricAPIScorecard {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  teams: string[];
  scorecard: CricAPIScorecardInning[];
  matchWinner?: string;
  manOfTheMatch?: { id: string; name: string };
}

// ── API Functions ────────────────────────────────────────────

/**
 * Get all current/recent matches
 * Costs: 1 API credit
 */
export async function getCurrentMatches(): Promise<CricAPIMatch[]> {
  const apiKey = getApiKey();
  const res = await fetch(`${CRICAPI_BASE}/currentMatches?apikey=${apiKey}&offset=0`);
  const json = await res.json();

  if (json.status !== 'success') {
    throw new Error(`CricAPI error: ${json.reason || 'Unknown error'}`);
  }

  return json.data || [];
}

/**
 * Search for IPL series to get series_id
 * Costs: 1 API credit
 */
export async function searchSeries(query: string = 'IPL 2026'): Promise<any[]> {
  const apiKey = getApiKey();
  const res = await fetch(`${CRICAPI_BASE}/series?apikey=${apiKey}&offset=0&search=${encodeURIComponent(query)}`);
  const json = await res.json();

  if (json.status !== 'success') {
    throw new Error(`CricAPI error: ${json.reason || 'Unknown error'}`);
  }

  return json.data || [];
}

/**
 * Get match info by match ID
 * Costs: 1 API credit
 */
export async function getMatchInfo(matchId: string): Promise<CricAPIMatch> {
  const apiKey = getApiKey();
  const res = await fetch(`${CRICAPI_BASE}/match_info?apikey=${apiKey}&id=${matchId}`);
  const json = await res.json();

  if (json.status !== 'success') {
    throw new Error(`CricAPI error: ${json.reason || 'Unknown error'}`);
  }

  return json.data;
}

/**
 * Get full match scorecard
 * Costs: 1 API credit
 */
export async function getMatchScorecard(matchId: string): Promise<CricAPIScorecard> {
  const apiKey = getApiKey();
  const res = await fetch(`${CRICAPI_BASE}/match_scorecard?apikey=${apiKey}&id=${matchId}`);
  const json = await res.json();

  if (json.status !== 'success') {
    throw new Error(`CricAPI error: ${json.reason || 'Unknown error'}`);
  }

  return json.data;
}

/**
 * Get all matches for a specific series
 * Costs: 1 API credit
 */
export async function getSeriesMatches(seriesId: string): Promise<CricAPIMatch[]> {
  const apiKey = getApiKey();
  const res = await fetch(`${CRICAPI_BASE}/series_info?apikey=${apiKey}&id=${seriesId}`);
  const json = await res.json();

  if (json.status !== 'success') {
    throw new Error(`CricAPI error: ${json.reason || 'Unknown error'}`);
  }

  return json.data?.matchList || [];
}

// ── IPL Team Name Mapping ────────────────────────────────────
// CricAPI uses full team names, we need to map to our abbreviations

const TEAM_NAME_MAP: Record<string, string> = {
  'Chennai Super Kings': 'CSK',
  'Mumbai Indians': 'MI',
  'Royal Challengers Bengaluru': 'RCB',
  'Royal Challengers Bangalore': 'RCB',
  'Kolkata Knight Riders': 'KKR',
  'Delhi Capitals': 'DC',
  'Punjab Kings': 'PBKS',
  'Kings XI Punjab': 'PBKS',
  'Rajasthan Royals': 'RR',
  'Gujarat Titans': 'GT',
  'Lucknow Super Giants': 'LSG',
  'Sunrisers Hyderabad': 'SRH',
};

export function mapTeamName(fullName: string): string {
  // Try exact match first
  if (TEAM_NAME_MAP[fullName]) return TEAM_NAME_MAP[fullName];

  // Try partial match
  for (const [key, value] of Object.entries(TEAM_NAME_MAP)) {
    if (fullName.toLowerCase().includes(key.toLowerCase().split(' ')[0])) {
      return value;
    }
  }

  return fullName;
}

/**
 * Filter only IPL matches from current matches
 */
export async function getCurrentIPLMatches(): Promise<CricAPIMatch[]> {
  const matches = await getCurrentMatches();
  return matches.filter(
    (m) =>
      m.matchType === 't20' &&
      (m.name?.toLowerCase().includes('ipl') ||
        m.series_id?.toLowerCase().includes('ipl') ||
        // Check if both teams are IPL teams
        m.teams?.every((t) => Object.keys(TEAM_NAME_MAP).some((k) => t.includes(k.split(' ')[0]))))
  );
}

/**
 * Get completed IPL matches that haven't been processed yet
 */
export async function getCompletedIPLMatches(): Promise<CricAPIMatch[]> {
  const matches = await getCurrentIPLMatches();
  return matches.filter((m) => m.matchEnded === true);
}

/**
 * Normalize player name for fuzzy matching with our database
 * Handles variations like "V Kohli" vs "Virat Kohli"
 */
export function normalizePlayerName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(Mr|Dr|Sri|Shri)\.?\s+/i, '')
    .toLowerCase();
}

/**
 * Find best matching player name from our database
 * Uses multiple strategies: exact, last name, initials
 */
export function findPlayerMatch(
  apiName: string,
  dbPlayers: Array<{ id: string; name: string; team: string }>
): { id: string; name: string; team: string } | null {
  const normalized = normalizePlayerName(apiName);

  // 1. Exact match (case-insensitive)
  const exact = dbPlayers.find((p) => normalizePlayerName(p.name) === normalized);
  if (exact) return exact;

  // 2. Last name match (most common in scorecards)
  const lastName = normalized.split(' ').pop() || '';
  const lastNameMatches = dbPlayers.filter((p) => {
    const pLast = normalizePlayerName(p.name).split(' ').pop() || '';
    return pLast === lastName;
  });
  if (lastNameMatches.length === 1) return lastNameMatches[0];

  // 3. Partial / contains match
  const partialMatches = dbPlayers.filter(
    (p) =>
      normalizePlayerName(p.name).includes(normalized) ||
      normalized.includes(normalizePlayerName(p.name))
  );
  if (partialMatches.length === 1) return partialMatches[0];

  // 4. Initials match (e.g., "RG Sharma" -> "Rohit Sharma")
  const parts = normalized.split(' ');
  if (parts.length >= 2) {
    const surnamePart = parts[parts.length - 1];
    const initialMatches = dbPlayers.filter((p) => {
      const pNorm = normalizePlayerName(p.name);
      return pNorm.endsWith(surnamePart) || pNorm.includes(surnamePart);
    });
    if (initialMatches.length === 1) return initialMatches[0];
  }

  return null;
}
