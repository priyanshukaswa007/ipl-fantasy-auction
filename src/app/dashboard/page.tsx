'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase';
import { generateRoomCode } from '@/lib/utils';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import type { Room, RoomMember, RoomStatus, AuctionMode } from '@/types';
import { DEFAULT_ROOM_SETTINGS } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MyLeague {
  room: Room;
  memberCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadgeVariant(status: RoomStatus) {
  switch (status) {
    case 'waiting':   return 'default' as const;
    case 'auction':   return 'warning' as const;
    case 'draft':     return 'info' as const;
    case 'active':    return 'success' as const;
    case 'complete':  return 'default' as const;
  }
}

function statusLabel(status: RoomStatus) {
  switch (status) {
    case 'waiting':  return 'Waiting';
    case 'auction':  return 'Auction';
    case 'draft':    return 'Draft';
    case 'active':   return 'Live';
    case 'complete': return 'Complete';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProfileSection() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(user?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function handleSave() {
    if (!nameValue.trim() || nameValue === user?.display_name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await updateProfile(nameValue.trim(), user?.avatar_url ?? null);
    setSaving(false);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setNameValue(user?.display_name ?? '');
      setEditing(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar
        src={user?.avatar_url}
        name={user?.display_name}
        size="lg"
        teamColor="border-amber-400"
      />
      <div className="flex flex-col gap-1">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-slate-800 border border-amber-500 rounded-lg px-3 py-1.5 text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30 w-48"
            />
            <Button size="sm" onClick={handleSave} loading={saving}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNameValue(user?.display_name ?? '');
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            className="flex items-center gap-2 group text-left"
            onClick={() => setEditing(true)}
            title="Click to edit display name"
          >
            <span className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
              {user?.display_name}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-500 group-hover:text-amber-400 transition-colors"
              aria-hidden="true"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
            </svg>
          </button>
        )}
        <span className="text-sm text-slate-400">{user?.email}</span>
      </div>
    </div>
  );
}

// ── Create League Card ────────────────────────────────────────────────────────

function CreateLeagueCard() {
  const { user } = useAuth();
  const router = useRouter();

  const [roomName, setRoomName]   = useState('');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [budget, setBudget]       = useState(DEFAULT_ROOM_SETTINGS.budget);
  const [mode, setMode]           = useState<AuctionMode>('live_auction');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  async function handleCreate() {
    if (!user) return;
    if (!roomName.trim()) { setError('Room name is required.'); return; }
    setError('');
    setLoading(true);

    const supabase  = getSupabaseBrowser();
    const roomCode  = generateRoomCode();

    const settings = {
      ...DEFAULT_ROOM_SETTINGS,
      budget,
      max_players: maxPlayers,
      auction_mode: mode,
    };

    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({
        room_code: roomCode,
        name: roomName.trim(),
        host_user_id: user.id,
        settings,
        status: 'waiting',
        season: '2026',
      })
      .select('*')
      .single();

    if (roomErr || !room) {
      setError(roomErr?.message ?? 'Failed to create room.');
      setLoading(false);
      return;
    }

    const { error: memberErr } = await supabase.from('room_members').insert({
      room_id: room.id,
      user_id: user.id,
      team_name: `${user.display_name}'s Team`,
      budget_remaining: budget,
      is_ready: false,
    });

    if (memberErr) {
      setError(memberErr.message);
      setLoading(false);
      return;
    }

    router.push(`/room/${roomCode}`);
  }

  return (
    <Card glow="gold" className="flex-1">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">🏆</span>
          <h2 className="text-lg font-bold text-white">Create a League</h2>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <Input
          label="Room Name"
          placeholder="e.g. Mumbai Mavericks Cup"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          error={error && !roomName.trim() ? error : undefined}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-300">
            Max Players
          </label>
          <select
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="w-full rounded-lg px-4 py-2.5 text-sm bg-slate-800/80 text-white border border-slate-700 hover:border-slate-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-colors"
          >
            {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>{n} players</option>
            ))}
          </select>
        </div>

        <Input
          label="Budget (Cr)"
          type="number"
          min={50}
          max={500}
          step={10}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-300">Auction Mode</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            <button
              type="button"
              onClick={() => setMode('live_auction')}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                mode === 'live_auction'
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              Live Auction
            </button>
            <button
              type="button"
              onClick={() => setMode('snake_draft')}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                mode === 'snake_draft'
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              Snake Draft
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <Button onClick={handleCreate} loading={loading} className="w-full mt-1">
          Create Room
        </Button>
      </CardBody>
    </Card>
  );
}

// ── Join League Card ──────────────────────────────────────────────────────────

function JoinLeagueCard() {
  const { user } = useAuth();
  const router   = useRouter();

  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleJoin() {
    if (!user) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Enter a room code.'); return; }
    setError('');
    setLoading(true);

    const supabase = getSupabaseBrowser();

    // Look up room
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', trimmed)
      .single();

    if (roomErr || !room) {
      setError('Room not found. Check the code and try again.');
      setLoading(false);
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', room.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      router.push(`/room/${trimmed}`);
      return;
    }

    // Check capacity
    const { count } = await supabase
      .from('room_members')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', room.id);

    if ((count ?? 0) >= room.settings.max_players) {
      setError('This room is full.');
      setLoading(false);
      return;
    }

    // Join
    const { error: joinErr } = await supabase.from('room_members').insert({
      room_id: room.id,
      user_id: user.id,
      team_name: `${user.display_name}'s Team`,
      budget_remaining: room.settings.budget,
      is_ready: false,
    });

    if (joinErr) {
      setError(joinErr.message);
      setLoading(false);
      return;
    }

    router.push(`/room/${trimmed}`);
  }

  return (
    <Card glow="purple" className="flex-1">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">🔗</span>
          <h2 className="text-lg font-bold text-white">Join a League</h2>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <Input
          label="Room Code"
          placeholder="IPL-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          error={error || undefined}
          hint="Format: IPL-XXXX (case-insensitive)"
        />

        <Button
          variant="secondary"
          onClick={handleJoin}
          loading={loading}
          className="w-full"
        >
          Join Room
        </Button>
      </CardBody>
    </Card>
  );
}

// ── My Leagues ────────────────────────────────────────────────────────────────

function MyLeagues() {
  const { user } = useAuth();
  const router   = useRouter();
  const [leagues, setLeagues]   = useState<MyLeague[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchLeagues() {
      const supabase = getSupabaseBrowser();

      const { data: memberships } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('user_id', user!.id);

      if (!memberships?.length) {
        setLoading(false);
        return;
      }

      const roomIds = memberships.map((m) => m.room_id);

      const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .in('id', roomIds)
        .order('created_at', { ascending: false });

      if (!rooms?.length) {
        setLoading(false);
        return;
      }

      // Fetch member counts per room
      const countResults = await Promise.all(
        rooms.map((r) =>
          supabase
            .from('room_members')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', r.id)
            .then(({ count }) => ({ roomId: r.id, count: count ?? 0 })),
        ),
      );

      const countMap: Record<string, number> = {};
      countResults.forEach(({ roomId, count }) => { countMap[roomId] = count; });

      setLeagues(rooms.map((r) => ({ room: r as Room, memberCount: countMap[r.id] ?? 0 })));
      setLoading(false);
    }

    fetchLeagues();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!leagues.length) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3" aria-hidden="true">🏏</p>
        <p className="font-medium">No leagues yet. Create or join one above!</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {leagues.map(({ room, memberCount }) => (
        <button
          key={room.id}
          onClick={() => router.push(`/room/${room.room_code}`)}
          className="text-left rounded-xl border border-white/10 bg-slate-900/60 hover:border-amber-500/40 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-200 p-4 group"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <span className="font-semibold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
              {room.name}
            </span>
            <Badge variant={statusBadgeVariant(room.status)}>
              {statusLabel(room.status)}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-amber-400">
              {room.room_code}
            </span>
            <span>{memberCount} / {room.settings.max_players} players</span>
            <span>IPL {room.season}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-purple-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Header ── */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent tracking-tight">
              IPL Fantasy
            </span>
            <Badge variant="warning">2026</Badge>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-slate-400">
              Welcome, <span className="text-white font-semibold">{user.display_name}</span>!
            </span>
            <Avatar src={user.avatar_url} name={user.display_name} size="sm" />
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </header>

        {/* ── Profile ── */}
        <Card className="mb-8">
          <CardBody>
            <ProfileSection />
          </CardBody>
        </Card>

        {/* ── Create / Join ── */}
        <div className="flex flex-col sm:flex-row gap-4 mb-10">
          <CreateLeagueCard />
          <JoinLeagueCard />
        </div>

        {/* ── My Leagues ── */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span aria-hidden="true">📋</span> My Leagues
          </h2>
          <MyLeagues />
        </section>
      </div>
    </div>
  );
}
