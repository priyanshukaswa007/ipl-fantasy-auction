'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import type { Room, RoomMember } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  text: string;
  timestamp: string;
}

interface MemberWithUser extends RoomMember {}

// ── Member Row ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  isCurrentUser,
  onTeamNameSave,
  onReadyToggle,
}: {
  member: MemberWithUser;
  isCurrentUser: boolean;
  onTeamNameSave: (memberId: string, name: string) => Promise<void>;
  onReadyToggle: (memberId: string, ready: boolean) => Promise<void>;
}) {
  const [editing, setEditing]     = useState(false);
  const [teamName, setTeamName]   = useState(member.team_name);
  const [saving, setSaving]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function handleSave() {
    const trimmed = teamName.trim();
    if (!trimmed || trimmed === member.team_name) { setEditing(false); return; }
    setSaving(true);
    await onTeamNameSave(member.id, trimmed);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-slate-800/60 border border-white/5">
      {/* Ready dot */}
      <div
        className={`h-2.5 w-2.5 rounded-full shrink-0 ${member.is_ready ? 'bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]' : 'bg-slate-600'}`}
        title={member.is_ready ? 'Ready' : 'Not ready'}
      />

      <Avatar
        src={member.user?.avatar_url}
        name={member.user?.display_name ?? member.team_name}
        size="sm"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300 font-medium truncate">
          {member.user?.display_name ?? 'Unknown'}
        </p>
        {editing ? (
          <div className="flex items-center gap-1 mt-0.5">
            <input
              ref={inputRef}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') { setTeamName(member.team_name); setEditing(false); }
              }}
              className="text-xs bg-slate-700 border border-amber-500 rounded px-2 py-0.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40 w-32"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50"
            >
              {saving ? '...' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            className={`text-xs text-slate-500 hover:text-amber-400 transition-colors text-left ${isCurrentUser ? 'cursor-pointer' : 'cursor-default pointer-events-none'}`}
            onClick={() => isCurrentUser && setEditing(true)}
            title={isCurrentUser ? 'Click to edit team name' : undefined}
          >
            {member.team_name}
            {isCurrentUser && (
              <span className="ml-1 opacity-0 group-hover:opacity-100 text-amber-400" aria-hidden="true">✏</span>
            )}
          </button>
        )}
      </div>

      {isCurrentUser && (
        <button
          onClick={() => onReadyToggle(member.id, !member.is_ready)}
          className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all ${
            member.is_ready
              ? 'border-emerald-500 text-emerald-400 bg-emerald-900/30 hover:bg-emerald-900/50'
              : 'border-slate-600 text-slate-400 bg-slate-800 hover:border-amber-500 hover:text-amber-400'
          }`}
        >
          {member.is_ready ? 'Ready ✓' : 'Ready?'}
        </button>
      )}

      {!isCurrentUser && member.is_ready && (
        <span className="text-xs text-emerald-400 font-medium">Ready</span>
      )}
    </div>
  );
}

// ── Chat ──────────────────────────────────────────────────────────────────────

function ChatArea({ roomId, roomCode }: { roomId: string; roomCode: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft]       = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel  = supabase.channel(`chat:${roomId}`);

    channel
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setMessages((prev) => [...prev.slice(-199), payload as ChatMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!draft.trim() || !user) return;
    const supabase = getSupabaseBrowser();
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      user_id: user.id,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      text: draft.trim(),
      timestamp: new Date().toISOString(),
    };
    await supabase.channel(`chat:${roomId}`).send({
      type: 'broadcast',
      event: 'chat',
      payload: msg,
    });
    setDraft('');
  }

  return (
    <div className="flex flex-col h-72">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 py-2">
        {messages.length === 0 && (
          <p className="text-xs text-slate-600 text-center pt-8">
            No messages yet. Say hi!
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 items-start ${m.user_id === user?.id ? 'flex-row-reverse' : ''}`}>
            <Avatar src={m.avatar_url} name={m.display_name} size="sm" />
            <div className={`max-w-[70%] ${m.user_id === user?.id ? 'items-end' : 'items-start'} flex flex-col`}>
              <span className="text-xs text-slate-500 mb-0.5">{m.display_name}</span>
              <div className={`rounded-xl px-3 py-1.5 text-sm text-white ${
                m.user_id === user?.id
                  ? 'bg-amber-600/70 rounded-tr-none'
                  : 'bg-slate-700/80 rounded-tl-none'
              }`}>
                {m.text}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-2 border-t border-white/10">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message..."
          className="flex-1 rounded-lg px-3 py-2 text-sm bg-slate-800/80 text-white border border-slate-700 hover:border-slate-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-colors placeholder:text-slate-500"
        />
        <Button size="sm" onClick={send} disabled={!draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoomPage() {
  const params   = useParams<{ roomCode: string }>();
  const roomCode = params?.roomCode ?? '';
  const router   = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [room, setRoom]             = useState<Room | null>(null);
  const [members, setMembers]       = useState<MemberWithUser[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError]           = useState('');
  const [copied, setCopied]         = useState(false);
  const [startingAuction, setStartingAuction] = useState(false);
  const [startingDraft, setStartingDraft]     = useState(false);

  // ── Fetch room & members ──
  const fetchData = useCallback(async () => {
    if (!roomCode) return;
    const supabase = getSupabaseBrowser();

    const { data: roomData, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', roomCode)
      .single();

    if (roomErr || !roomData) {
      setError('Room not found.');
      setPageLoading(false);
      return;
    }

    const fetchedRoom = roomData as Room;
    setRoom(fetchedRoom);

    // Redirect if already past waiting
    if (fetchedRoom.status === 'auction') {
      router.replace(`/room/${roomCode}/auction`);
      return;
    }
    if (fetchedRoom.status === 'draft') {
      router.replace(`/room/${roomCode}/draft`);
      return;
    }
    if (fetchedRoom.status === 'active') {
      router.replace(`/room/${roomCode}/leaderboard`);
      return;
    }

    // Fetch members with user data
    const { data: memberData } = await supabase
      .from('room_members')
      .select('*, user:users(*)')
      .eq('room_id', fetchedRoom.id)
      .order('joined_at', { ascending: true });

    setMembers((memberData ?? []) as MemberWithUser[]);
    setPageLoading(false);
  }, [roomCode, router]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  // ── Realtime: room_members ──
  useEffect(() => {
    if (!room) return;
    const supabase = getSupabaseBrowser();

    const channel = supabase
      .channel(`room_members:${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${room.id}` },
        () => { fetchData(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room, fetchData]);

  // ── Actions ──

  async function handleTeamNameSave(memberId: string, name: string) {
    const supabase = getSupabaseBrowser();
    await supabase.from('room_members').update({ team_name: name }).eq('id', memberId);
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, team_name: name } : m));
  }

  async function handleReadyToggle(memberId: string, ready: boolean) {
    const supabase = getSupabaseBrowser();
    await supabase.from('room_members').update({ is_ready: ready }).eq('id', memberId);
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, is_ready: ready } : m));
  }

  async function handleStartAuction() {
    if (!room) return;
    setStartingAuction(true);
    const supabase = getSupabaseBrowser();
    await supabase.from('rooms').update({ status: 'auction' }).eq('id', room.id);
    router.push(`/room/${roomCode}/auction`);
  }

  async function handleStartDraft() {
    if (!room) return;
    setStartingDraft(true);
    const supabase = getSupabaseBrowser();
    await supabase.from('rooms').update({ status: 'draft' }).eq('id', room.id);
    router.push(`/room/${roomCode}/draft`);
  }

  async function copyCode() {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Guards ──
  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center gap-4">
        <p className="text-4xl" aria-hidden="true">🏏</p>
        <p className="text-xl font-semibold text-white">{error}</p>
        <Link href="/dashboard">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  if (!room) return null;

  const isHost       = user?.id === room.host_user_id;
  const readyCount   = members.filter((m) => m.is_ready).length;
  const myMember     = members.find((m) => m.user_id === user?.id);
  const canStart     = readyCount >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 right-0 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-purple-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Back + Header ── */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Back">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">{room.name}</h1>
            <p className="text-sm text-slate-400">IPL {room.season} &middot; Lobby</p>
          </div>
        </div>

        {/* ── Room Code Banner ── */}
        <Card glow="gold" className="mb-6">
          <CardBody className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-1">Room Code</p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-black text-amber-400 tracking-widest">
                    {room.room_code}
                  </span>
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-1.5"
                  >
                    {copied ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex flex-col items-center bg-slate-800/80 rounded-lg px-4 py-2">
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Budget</span>
                  <span className="font-bold text-white">{room.settings.budget} Cr</span>
                </div>
                <div className="flex flex-col items-center bg-slate-800/80 rounded-lg px-4 py-2">
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Mode</span>
                  <span className="font-bold text-white capitalize">
                    {room.settings.auction_mode === 'live_auction' ? 'Live Auction' : 'Snake Draft'}
                  </span>
                </div>
                <div className="flex flex-col items-center bg-slate-800/80 rounded-lg px-4 py-2">
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Players</span>
                  <span className="font-bold text-white">{members.length} / {room.settings.max_players}</span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Members List ── */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-white flex items-center gap-2">
                    <span aria-hidden="true">👥</span>
                    Members
                    <span className="text-sm text-slate-400 font-normal">({members.length})</span>
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
                    {readyCount} ready
                  </div>
                </div>
              </CardHeader>
              <CardBody className="flex flex-col gap-2">
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isCurrentUser={m.user_id === user?.id}
                    onTeamNameSave={handleTeamNameSave}
                    onReadyToggle={handleReadyToggle}
                  />
                ))}
                {members.length === 0 && (
                  <p className="text-center text-slate-500 text-sm py-6">No members yet.</p>
                )}
              </CardBody>
            </Card>

            {/* ── Host Controls ── */}
            {isHost && (
              <Card glow="gold">
                <CardHeader>
                  <h2 className="font-bold text-white flex items-center gap-2">
                    <span aria-hidden="true">👑</span>
                    Host Controls
                  </h2>
                </CardHeader>
                <CardBody className="flex flex-col gap-3">
                  {!canStart && (
                    <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                      At least 2 members must be ready to start.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handleStartAuction}
                      loading={startingAuction}
                      disabled={!canStart}
                      className="flex-1"
                    >
                      Start Auction
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleStartDraft}
                      loading={startingDraft}
                      disabled={!canStart}
                      className="flex-1"
                    >
                      Start Draft
                    </Button>
                  </div>
                  <Link href={`/room/${roomCode}/settings`} className="w-full">
                    <Button variant="ghost" size="sm" className="w-full">
                      Room Settings
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            )}
          </div>

          {/* ── Chat ── */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <h2 className="font-bold text-white flex items-center gap-2">
                  <span aria-hidden="true">💬</span>
                  Chat
                </h2>
              </CardHeader>
              <CardBody>
                <ChatArea roomId={room.id} roomCode={roomCode} />
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
