'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase';
import { calculateFantasyPoints, type ScoringInput } from '@/lib/scoring';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { MatchResult, PlayerMatchStats, Player, Room, IPLTeam } from '@/types';

// ── Tab type ──────────────────────────────────────────────────────────────────

type TabId = 'matches' | 'stats' | 'leaderboard' | 'players';

// ── IPL teams ─────────────────────────────────────────────────────────────────

const IPL_TEAMS: IPLTeam[] = ['CSK', 'MI', 'RCB', 'KKR', 'DC', 'PBKS', 'RR', 'GT', 'LSG', 'SRH'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
      {children}
    </h2>
  );
}

// ── Match Results tab ─────────────────────────────────────────────────────────

function MatchResultsTab() {
  const [matches, setMatches]   = useState<MatchResult[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [error, setError]       = useState('');

  const blankForm = {
    match_number: '',
    team_a: 'CSK' as IPLTeam,
    team_b: 'MI' as IPLTeam,
    winner: '' as IPLTeam | '',
    date: '',
    venue: '',
    season: '2026',
  };
  const [form, setForm] = useState(blankForm);

  const fetchMatches = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from('match_results')
      .select('*')
      .order('match_number', { ascending: true });
    setMatches((data ?? []) as MatchResult[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  async function handleSave() {
    if (!form.match_number || !form.team_a || !form.team_b || !form.date) {
      setError('Match number, teams, and date are required.');
      return;
    }
    setSaving(true);
    setError('');
    const supabase = getSupabaseBrowser();
    const row = {
      match_number: parseInt(form.match_number, 10),
      team_a: form.team_a,
      team_b: form.team_b,
      winner: form.winner || null,
      date: form.date,
      venue: form.venue,
      season: form.season,
    };

    if (editId) {
      await supabase.from('match_results').update(row).eq('id', editId);
    } else {
      await supabase.from('match_results').insert(row);
    }

    setForm(blankForm);
    setEditId(null);
    setSaving(false);
    await fetchMatches();
  }

  async function handleDelete(id: string) {
    const supabase = getSupabaseBrowser();
    await supabase.from('match_results').delete().eq('id', id);
    await fetchMatches();
  }

  function handleEdit(m: MatchResult) {
    setEditId(m.id);
    setForm({
      match_number: String(m.match_number),
      team_a: m.team_a,
      team_b: m.team_b,
      winner: m.winner ?? '',
      date: m.date,
      venue: m.venue,
      season: m.season,
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Form */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <SectionTitle>{editId ? 'Edit Match' : 'Add Match Result'}</SectionTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <Input
              label="Match Number"
              type="number"
              value={form.match_number}
              onChange={(e) => setForm({ ...form, match_number: e.target.value })}
              placeholder="e.g. 1"
            />

            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">Team A</label>
                <select
                  value={form.team_a}
                  onChange={(e) => setForm({ ...form, team_a: e.target.value as IPLTeam })}
                  className="w-full rounded-lg px-3 py-2.5 text-sm bg-slate-800/80 text-white border border-slate-700 focus:border-amber-500 focus:outline-none"
                >
                  {IPL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">Team B</label>
                <select
                  value={form.team_b}
                  onChange={(e) => setForm({ ...form, team_b: e.target.value as IPLTeam })}
                  className="w-full rounded-lg px-3 py-2.5 text-sm bg-slate-800/80 text-white border border-slate-700 focus:border-amber-500 focus:outline-none"
                >
                  {IPL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Winner</label>
              <select
                value={form.winner}
                onChange={(e) => setForm({ ...form, winner: e.target.value as IPLTeam | '' })}
                className="w-full rounded-lg px-3 py-2.5 text-sm bg-slate-800/80 text-white border border-slate-700 focus:border-amber-500 focus:outline-none"
              >
                <option value="">No result / TBD</option>
                {IPL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <Input
              label="Venue"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              placeholder="e.g. Wankhede Stadium, Mumbai"
            />
            <Input
              label="Season"
              value={form.season}
              onChange={(e) => setForm({ ...form, season: e.target.value })}
            />

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <div className="flex gap-2">
              <Button loading={saving} onClick={handleSave} className="flex-1">
                {editId ? 'Update' : 'Add Match'}
              </Button>
              {editId && (
                <Button variant="ghost" onClick={() => { setEditId(null); setForm(blankForm); }}>
                  Cancel
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* List */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <SectionTitle>Match Results ({matches.length})</SectionTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : matches.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-8">No matches added yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {matches.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/60 border border-white/5"
                  >
                    <span className="text-xs font-bold text-slate-500 w-8 shrink-0">M{m.match_number}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {m.team_a} vs {m.team_b}
                      </p>
                      <p className="text-xs text-slate-500">
                        {m.winner ? `Winner: ${m.winner}` : 'No result'} &middot; {m.date}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(m)}
                        className="text-xs text-slate-400 hover:text-amber-400 transition-colors px-2 py-1 rounded-md hover:bg-white/5"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-xs text-slate-400 hover:text-red-400 transition-colors px-2 py-1 rounded-md hover:bg-red-900/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ── Player stats form row ─────────────────────────────────────────────────────

interface StatFormState {
  player_id: string;
  player_name: string;
  role: string;
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
  preview_points: number | null;
}

function StatRow({
  stat,
  onChange,
  onCalcPoints,
}: {
  stat: StatFormState;
  onChange: (updates: Partial<StatFormState>) => void;
  onCalcPoints: () => void;
}) {
  const numField = (key: keyof StatFormState, label: string) => (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</label>
      <input
        type="number"
        min={0}
        value={stat[key] as number}
        onChange={(e) => onChange({ [key]: parseFloat(e.target.value) || 0 })}
        className="w-16 text-sm bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white focus:border-amber-500 focus:outline-none"
      />
    </div>
  );

  const boolField = (key: keyof StatFormState, label: string) => (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={stat[key] as boolean}
        onChange={(e) => onChange({ [key]: e.target.checked })}
        className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/20"
      />
      <span className="text-xs text-slate-400">{label}</span>
    </label>
  );

  return (
    <div className="rounded-xl bg-slate-800/60 border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">{stat.player_name}</p>
          <p className="text-xs text-slate-500">{stat.role}</p>
        </div>
        <div className="flex items-center gap-2">
          {stat.preview_points !== null && (
            <span className={cn(
              'text-sm font-bold px-2 py-0.5 rounded-md',
              stat.preview_points >= 100 ? 'text-emerald-400 bg-emerald-900/30' :
              stat.preview_points >= 50  ? 'text-amber-400 bg-amber-900/30' :
                                           'text-slate-300 bg-slate-700/50',
            )}>
              {stat.preview_points} pts
            </span>
          )}
          <button
            type="button"
            onClick={onCalcPoints}
            className="text-xs text-amber-400 hover:text-amber-300 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-600/30 px-2 py-1 rounded-md transition-colors"
          >
            Preview
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Batting */}
        <div className="flex flex-wrap gap-2">
          {numField('runs', 'Runs')}
          {numField('balls_faced', 'Balls')}
          {numField('fours', '4s')}
          {numField('sixes', '6s')}
        </div>
        <div className="w-px bg-white/10 self-stretch" />
        {/* Bowling */}
        <div className="flex flex-wrap gap-2">
          {numField('wickets', 'Wkts')}
          {numField('overs_bowled', 'Overs')}
          {numField('runs_conceded', 'Runs')}
          {numField('maidens', 'Mdns')}
        </div>
        <div className="w-px bg-white/10 self-stretch" />
        {/* Fielding */}
        <div className="flex flex-wrap gap-2">
          {numField('catches', 'Cts')}
          {numField('stumpings', 'Stmp')}
          {numField('run_outs_direct', 'RO Dir')}
          {numField('run_outs_indirect', 'RO Ind')}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mt-3">
        {boolField('potm', 'Player of Match')}
        {boolField('did_not_bat', 'Did Not Bat')}
        {boolField('is_winner', 'Winning Team')}
      </div>
    </div>
  );
}

// ── Player Stats tab ──────────────────────────────────────────────────────────

function PlayerStatsTab() {
  const [matches, setMatches]     = useState<MatchResult[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [matchPlayers, setMatchPlayers]       = useState<Player[]>([]);
  const [statForms, setStatForms]             = useState<StatFormState[]>([]);
  const [saving, setSaving]                   = useState(false);
  const [recalculating, setRecalculating]     = useState(false);
  const [saveMsg, setSaveMsg]                 = useState('');

  // Load matches
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase
      .from('match_results')
      .select('*')
      .order('match_number', { ascending: true })
      .then(({ data }) => setMatches((data ?? []) as MatchResult[]));
  }, []);

  // When match selected, load players for that match's teams
  useEffect(() => {
    if (!selectedMatchId) { setMatchPlayers([]); setStatForms([]); return; }
    const match = matches.find((m) => m.id === selectedMatchId);
    if (!match) return;

    const supabase = getSupabaseBrowser();
    supabase
      .from('players')
      .select('*')
      .in('team', [match.team_a, match.team_b])
      .order('name', { ascending: true })
      .then(({ data }) => {
        const players = (data ?? []) as Player[];
        setMatchPlayers(players);

        // Pre-populate stat forms (or load existing stats)
        supabase
          .from('player_match_stats')
          .select('*')
          .eq('match_id', selectedMatchId)
          .then(({ data: existing }) => {
            const existingMap = new Map<string, PlayerMatchStats>(
              ((existing ?? []) as PlayerMatchStats[]).map((s) => [s.player_id, s]),
            );

            setStatForms(
              players.map((p) => {
                const ex = existingMap.get(p.id);
                return {
                  player_id: p.id,
                  player_name: p.name,
                  role: p.role,
                  runs: ex?.runs ?? 0,
                  balls_faced: ex?.balls_faced ?? 0,
                  fours: ex?.fours ?? 0,
                  sixes: ex?.sixes ?? 0,
                  wickets: ex?.wickets ?? 0,
                  overs_bowled: ex?.overs_bowled ?? 0,
                  runs_conceded: ex?.runs_conceded ?? 0,
                  maidens: ex?.maidens ?? 0,
                  catches: ex?.catches ?? 0,
                  stumpings: ex?.stumpings ?? 0,
                  run_outs_direct: ex?.run_outs_direct ?? 0,
                  run_outs_indirect: ex?.run_outs_indirect ?? 0,
                  potm: ex?.potm ?? false,
                  did_not_bat: ex?.did_not_bat ?? false,
                  is_winner: ex?.is_winner ?? false,
                  preview_points: ex?.fantasy_points ?? null,
                };
              }),
            );
          });
      });
  }, [selectedMatchId, matches]);

  function updateStat(idx: number, updates: Partial<StatFormState>) {
    setStatForms((prev) => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  }

  function calcPoints(idx: number) {
    const s = statForms[idx];
    const input: ScoringInput = {
      runs: s.runs,
      balls_faced: s.balls_faced,
      fours: s.fours,
      sixes: s.sixes,
      wickets: s.wickets,
      overs_bowled: s.overs_bowled,
      runs_conceded: s.runs_conceded,
      maidens: s.maidens,
      catches: s.catches,
      stumpings: s.stumpings,
      run_outs_direct: s.run_outs_direct,
      run_outs_indirect: s.run_outs_indirect,
      potm: s.potm,
      did_not_bat: s.did_not_bat,
      is_winner: s.is_winner,
      role: s.role,
    };
    const pts = calculateFantasyPoints(input);
    updateStat(idx, { preview_points: pts });
  }

  function calcAllPoints() {
    setStatForms((prev) =>
      prev.map((s) => ({
        ...s,
        preview_points: calculateFantasyPoints({
          runs: s.runs, balls_faced: s.balls_faced, fours: s.fours, sixes: s.sixes,
          wickets: s.wickets, overs_bowled: s.overs_bowled, runs_conceded: s.runs_conceded,
          maidens: s.maidens, catches: s.catches, stumpings: s.stumpings,
          run_outs_direct: s.run_outs_direct, run_outs_indirect: s.run_outs_indirect,
          potm: s.potm, did_not_bat: s.did_not_bat, is_winner: s.is_winner, role: s.role,
        }),
      })),
    );
  }

  async function handleSave() {
    if (!selectedMatchId) return;
    setSaving(true);
    setSaveMsg('');
    const supabase = getSupabaseBrowser();

    const rows = statForms
      .filter((s) => s.runs > 0 || s.wickets > 0 || s.catches > 0 || s.stumpings > 0 || s.balls_faced > 0)
      .map((s) => ({
        player_id: s.player_id,
        match_id: selectedMatchId,
        runs: s.runs,
        balls_faced: s.balls_faced,
        fours: s.fours,
        sixes: s.sixes,
        wickets: s.wickets,
        overs_bowled: s.overs_bowled,
        runs_conceded: s.runs_conceded,
        maidens: s.maidens,
        catches: s.catches,
        stumpings: s.stumpings,
        run_outs_direct: s.run_outs_direct,
        run_outs_indirect: s.run_outs_indirect,
        potm: s.potm,
        did_not_bat: s.did_not_bat,
        is_winner: s.is_winner,
        fantasy_points: s.preview_points ?? calculateFantasyPoints({
          runs: s.runs, balls_faced: s.balls_faced, fours: s.fours, sixes: s.sixes,
          wickets: s.wickets, overs_bowled: s.overs_bowled, runs_conceded: s.runs_conceded,
          maidens: s.maidens, catches: s.catches, stumpings: s.stumpings,
          run_outs_direct: s.run_outs_direct, run_outs_indirect: s.run_outs_indirect,
          potm: s.potm, did_not_bat: s.did_not_bat, is_winner: s.is_winner, role: s.role,
        }),
      }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from('player_match_stats')
        .upsert(rows, { onConflict: 'player_id,match_id' });

      if (error) {
        setSaveMsg(`Error: ${error.message}`);
      } else {
        setSaveMsg(`Saved ${rows.length} player stats.`);
      }
    } else {
      setSaveMsg('No stats to save (all zeroes).');
    }

    setSaving(false);
  }

  async function handleRecalculateAll() {
    if (!selectedMatchId) return;
    setRecalculating(true);
    const supabase = getSupabaseBrowser();

    const { data: stats } = await supabase
      .from('player_match_stats')
      .select('*, player:players(role)')
      .eq('match_id', selectedMatchId);

    for (const stat of (stats ?? []) as (PlayerMatchStats & { player?: { role: string } })[]) {
      const pts = calculateFantasyPoints({
        runs: stat.runs, balls_faced: stat.balls_faced, fours: stat.fours, sixes: stat.sixes,
        wickets: stat.wickets, overs_bowled: stat.overs_bowled, runs_conceded: stat.runs_conceded,
        maidens: stat.maidens, catches: stat.catches, stumpings: stat.stumpings,
        run_outs_direct: stat.run_outs_direct, run_outs_indirect: stat.run_outs_indirect,
        potm: stat.potm, did_not_bat: stat.did_not_bat, is_winner: stat.is_winner,
        role: stat.player?.role ?? 'Batter',
      });
      await supabase
        .from('player_match_stats')
        .update({ fantasy_points: pts })
        .eq('id', stat.id);
    }

    setSaveMsg(`Recalculated ${(stats ?? []).length} stats.`);
    setRecalculating(false);
  }

  const selectedMatch = matches.find((m) => m.id === selectedMatchId);

  return (
    <div className="flex flex-col gap-4">
      {/* Match selector */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-col gap-1.5 flex-1 min-w-40">
              <label className="text-sm font-medium text-slate-300">Select Match</label>
              <select
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm bg-slate-800/80 text-white border border-slate-700 focus:border-amber-500 focus:outline-none"
              >
                <option value="">-- Select a match --</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    M{m.match_number}: {m.team_a} vs {m.team_b} ({m.date})
                  </option>
                ))}
              </select>
            </div>
            {selectedMatchId && (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="secondary" onClick={calcAllPoints}>
                  Calculate All Points
                </Button>
                <Button size="sm" onClick={handleSave} loading={saving}>
                  Save All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRecalculateAll}
                  loading={recalculating}
                >
                  Recalculate All
                </Button>
              </div>
            )}
          </div>
          {saveMsg && (
            <p className="mt-2 text-sm text-amber-400">{saveMsg}</p>
          )}
        </CardBody>
      </Card>

      {/* Stat rows */}
      {selectedMatchId && (
        <>
          {matchPlayers.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No players found for {selectedMatch?.team_a} / {selectedMatch?.team_b}.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {statForms.map((stat, idx) => (
                <StatRow
                  key={stat.player_id}
                  stat={stat}
                  onChange={(u) => updateStat(idx, u)}
                  onCalcPoints={() => calcPoints(idx)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Leaderboard tab ───────────────────────────────────────────────────────────

function LeaderboardTab() {
  const [rooms, setRooms]           = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<{ user_id: string; user_name: string; total_points: number; rank: number }[]>([]);
  const [recalculating, setRecalculating] = useState(false);
  const [msg, setMsg]               = useState('');

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRooms((data ?? []) as Room[]));
  }, []);

  const fetchLeaderboard = useCallback(async (roomId: string) => {
    if (!roomId) return;
    const supabase = getSupabaseBrowser();
    const { data } = await supabase
      .from('leaderboard_cache')
      .select('*, user:users(display_name)')
      .eq('room_id', roomId)
      .order('rank', { ascending: true });

    setLeaderboard(
      ((data ?? []) as { user_id: string; total_points: number; rank: number; user?: { display_name: string } }[])
        .map((e) => ({
          user_id: e.user_id,
          user_name: e.user?.display_name ?? 'Unknown',
          total_points: e.total_points,
          rank: e.rank,
        })),
    );
  }, []);

  useEffect(() => {
    if (selectedRoomId) fetchLeaderboard(selectedRoomId);
  }, [selectedRoomId, fetchLeaderboard]);

  async function handleRecalculate() {
    if (!selectedRoomId) return;
    setRecalculating(true);
    setMsg('');
    const supabase = getSupabaseBrowser();

    const [membersRes, picksRes] = await Promise.all([
      supabase.from('room_members').select('user_id').eq('room_id', selectedRoomId),
      supabase.from('auction_picks').select('user_id, player_id').eq('room_id', selectedRoomId),
    ]);

    const members = membersRes.data ?? [];
    const picks   = picksRes.data ?? [];
    const playerIds = [...new Set(picks.map((p: { player_id: string }) => p.player_id))];

    const statsRes = playerIds.length > 0
      ? await supabase.from('player_match_stats').select('player_id, fantasy_points').in('player_id', playerIds)
      : { data: [] };

    const playerPoints: Record<string, number> = {};
    for (const s of (statsRes.data ?? []) as { player_id: string; fantasy_points: number }[]) {
      playerPoints[s.player_id] = (playerPoints[s.player_id] ?? 0) + (s.fantasy_points ?? 0);
    }

    const userTotals: Record<string, number> = {};
    for (const pick of picks as { user_id: string; player_id: string }[]) {
      userTotals[pick.user_id] = (userTotals[pick.user_id] ?? 0) + (playerPoints[pick.player_id] ?? 0);
    }

    const sorted = (members as { user_id: string }[])
      .map((m) => ({ user_id: m.user_id, total_points: userTotals[m.user_id] ?? 0 }))
      .sort((a, b) => b.total_points - a.total_points);

    const upsertRows = sorted.map((row, idx) => ({
      room_id: selectedRoomId,
      user_id: row.user_id,
      total_points: row.total_points,
      last_match_points: 0,
      rank: idx + 1,
      updated_at: new Date().toISOString(),
    }));

    if (upsertRows.length > 0) {
      await supabase
        .from('leaderboard_cache')
        .upsert(upsertRows, { onConflict: 'room_id,user_id' });
    }

    setMsg(`Updated ${upsertRows.length} leaderboard entries.`);
    await fetchLeaderboard(selectedRoomId);
    setRecalculating(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-40 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Select Room</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm bg-slate-800/80 text-white border border-slate-700 focus:border-amber-500 focus:outline-none"
              >
                <option value="">-- Select a room --</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.room_code})</option>
                ))}
              </select>
            </div>
            {selectedRoomId && (
              <Button onClick={handleRecalculate} loading={recalculating}>
                Recalculate Leaderboard
              </Button>
            )}
          </div>
          {msg && <p className="mt-2 text-sm text-emerald-400">{msg}</p>}
        </CardBody>
      </Card>

      {leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <SectionTitle>Current Leaderboard</SectionTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col gap-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.user_id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/60 border border-white/5"
                >
                  <span
                    className={cn(
                      'text-sm font-black w-7 text-center shrink-0',
                      entry.rank === 1 ? 'text-amber-400' :
                      entry.rank === 2 ? 'text-slate-300' :
                      entry.rank === 3 ? 'text-amber-700' : 'text-slate-500',
                    )}
                  >
                    #{entry.rank}
                  </span>
                  <p className="flex-1 text-sm font-semibold text-white truncate">{entry.user_name}</p>
                  <span className="text-sm font-bold text-amber-400">{entry.total_points} pts</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

// ── Player Management tab ─────────────────────────────────────────────────────

function PlayerManagementTab() {
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting]   = useState(false);
  const [importMsg, setImportMsg]   = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [editPlayer, setEditPlayer]   = useState<Player | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [players, setPlayers]         = useState<Player[]>([]);
  const [pLoading, setPLoading]       = useState(false);
  const [savingPlayer, setSavingPlayer] = useState(false);

  const [bulkPriceStr, setBulkPriceStr] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkMsg, setBulkMsg]           = useState('');

  const fetchPlayers = useCallback(async (query: string) => {
    if (!query.trim() && !query) return;
    setPLoading(true);
    const supabase = getSupabaseBrowser();
    const req = supabase.from('players').select('*').order('name', { ascending: true });
    if (query.trim()) {
      req.ilike('name', `%${query.trim()}%`);
    }
    const { data } = await req.limit(50);
    setPlayers((data ?? []) as Player[]);
    setPLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { fetchPlayers(searchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchPlayers]);

  async function handleImport() {
    setImportError('');
    setImportMsg('');
    try {
      const parsed = JSON.parse(importJson);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      setImporting(true);
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.from('players').upsert(arr, { onConflict: 'id' });
      if (error) throw error;
      setImportMsg(`Imported ${arr.length} players.`);
      setImportJson('');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Invalid JSON');
    } finally {
      setImporting(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setImportJson(ev.target?.result as string ?? ''); };
    reader.readAsText(file);
  }

  async function handleSavePlayer() {
    if (!editPlayer) return;
    setSavingPlayer(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase
      .from('players')
      .update({
        name: editPlayer.name,
        team: editPlayer.team,
        role: editPlayer.role,
        nationality: editPlayer.nationality,
        base_price: editPlayer.base_price,
        ipl_price: editPlayer.ipl_price,
        rating: editPlayer.rating,
      })
      .eq('id', editPlayer.id);

    if (!error) {
      setPlayers((prev) => prev.map((p) => p.id === editPlayer.id ? editPlayer : p));
      setEditPlayer(null);
    }
    setSavingPlayer(false);
  }

  async function handleBulkPriceUpdate() {
    setBulkMsg('');
    let parsed: { id: string; base_price: number }[];
    try {
      parsed = JSON.parse(bulkPriceStr);
      if (!Array.isArray(parsed)) throw new Error('Expected an array');
    } catch (e) {
      setBulkMsg(`Parse error: ${e instanceof Error ? e.message : 'Invalid JSON'}`);
      return;
    }
    setBulkUpdating(true);
    const supabase = getSupabaseBrowser();
    let updated = 0;
    for (const item of parsed) {
      if (!item.id || typeof item.base_price !== 'number') continue;
      await supabase.from('players').update({ base_price: item.base_price }).eq('id', item.id);
      updated++;
    }
    setBulkMsg(`Updated base prices for ${updated} players.`);
    setBulkUpdating(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Import */}
      <Card>
        <CardHeader>
          <SectionTitle>Import Players (JSON)</SectionTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='Paste player JSON here, e.g. [{"id":"...","name":"...","team":"CSK",...}]'
            rows={6}
            className="w-full rounded-lg px-3 py-2.5 text-sm bg-slate-800/80 text-white border border-slate-700 focus:border-amber-500 focus:outline-none resize-y font-mono placeholder:text-slate-500"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              Upload JSON File
            </Button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
            <Button size="sm" onClick={handleImport} loading={importing} disabled={!importJson.trim()}>
              Import
            </Button>
          </div>
          {importError && <p className="text-xs text-red-400">{importError}</p>}
          {importMsg  && <p className="text-xs text-emerald-400">{importMsg}</p>}
        </CardBody>
      </Card>

      {/* Edit player */}
      <Card>
        <CardHeader>
          <SectionTitle>Edit Player</SectionTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <Input
            label="Search by name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g. Rohit Sharma"
          />

          {pLoading && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!pLoading && players.length > 0 && !editPlayer && (
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setEditPlayer(p)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/60 border border-white/5 hover:border-amber-500/40 transition-colors text-left"
                >
                  <span className="text-xs font-bold text-slate-500 w-10 shrink-0">{p.team}</span>
                  <span className="flex-1 text-sm text-white">{p.name}</span>
                  <span className="text-xs text-slate-500">{p.role}</span>
                </button>
              ))}
            </div>
          )}

          {editPlayer && (
            <div className="rounded-xl bg-slate-800/60 border border-amber-500/30 p-4 flex flex-col gap-3">
              <p className="text-xs text-amber-400 font-semibold uppercase tracking-wide">Editing: {editPlayer.name}</p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Name"
                  value={editPlayer.name}
                  onChange={(e) => setEditPlayer({ ...editPlayer, name: e.target.value })}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-300">Team</label>
                  <select
                    value={editPlayer.team}
                    onChange={(e) => setEditPlayer({ ...editPlayer, team: e.target.value as IPLTeam })}
                    className="w-full rounded-lg px-3 py-2.5 text-sm bg-slate-800/80 text-white border border-slate-700 focus:border-amber-500 focus:outline-none"
                  >
                    {IPL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-300">Role</label>
                  <select
                    value={editPlayer.role}
                    onChange={(e) => setEditPlayer({ ...editPlayer, role: e.target.value as Player['role'] })}
                    className="w-full rounded-lg px-3 py-2.5 text-sm bg-slate-800/80 text-white border border-slate-700 focus:border-amber-500 focus:outline-none"
                  >
                    {['Batter', 'Bowler', 'All-Rounder', 'Wicketkeeper'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Nationality"
                  value={editPlayer.nationality}
                  onChange={(e) => setEditPlayer({ ...editPlayer, nationality: e.target.value })}
                />
                <Input
                  label="Base Price (Cr)"
                  type="number"
                  step="0.25"
                  value={editPlayer.base_price}
                  onChange={(e) => setEditPlayer({ ...editPlayer, base_price: parseFloat(e.target.value) || 0 })}
                />
                <Input
                  label="IPL Price (Cr)"
                  type="number"
                  step="0.25"
                  value={editPlayer.ipl_price}
                  onChange={(e) => setEditPlayer({ ...editPlayer, ipl_price: parseFloat(e.target.value) || 0 })}
                />
                <Input
                  label="Rating (0–99)"
                  type="number"
                  min={0}
                  max={99}
                  value={editPlayer.rating}
                  onChange={(e) => setEditPlayer({ ...editPlayer, rating: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSavePlayer} loading={savingPlayer}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditPlayer(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Bulk price update */}
      <Card>
        <CardHeader>
          <SectionTitle>Bulk Update Base Prices</SectionTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">Paste a JSON array of {`{"id":"...", "base_price": N}`} objects.</p>
          <textarea
            value={bulkPriceStr}
            onChange={(e) => setBulkPriceStr(e.target.value)}
            placeholder='[{"id":"abc123","base_price":2.0},...]'
            rows={5}
            className="w-full rounded-lg px-3 py-2.5 text-sm bg-slate-800/80 text-white border border-slate-700 focus:border-amber-500 focus:outline-none resize-y font-mono placeholder:text-slate-500"
          />
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleBulkPriceUpdate} loading={bulkUpdating} disabled={!bulkPriceStr.trim()}>
              Apply Bulk Update
            </Button>
            {bulkMsg && <p className="text-sm text-amber-400">{bulkMsg}</p>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('matches');

  const TABS: { id: TabId; label: string }[] = [
    { id: 'matches',    label: 'Match Results' },
    { id: 'stats',      label: 'Player Stats' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'players',    label: 'Player Mgmt' },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center gap-4">
        <p className="text-xl font-semibold text-white">Please sign in to access the admin panel.</p>
        <Link href="/login">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-purple-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Back">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              Admin Panel
              <Badge variant="warning">Staff Only</Badge>
            </h1>
            <p className="text-sm text-slate-400">Manage match data, player stats, and leaderboards</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-slate-900/60 border border-white/8 rounded-xl p-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150',
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-900 shadow-md shadow-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'matches'     && <MatchResultsTab />}
        {activeTab === 'stats'       && <PlayerStatsTab />}
        {activeTab === 'leaderboard' && <LeaderboardTab />}
        {activeTab === 'players'     && <PlayerManagementTab />}
      </div>
    </div>
  );
}
