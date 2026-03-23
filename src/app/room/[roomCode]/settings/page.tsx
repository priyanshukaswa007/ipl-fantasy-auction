'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Room, RoomSettings, AuctionMode } from '@/types';
import { DEFAULT_ROOM_SETTINGS } from '@/types';

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative h-6 w-11 shrink-0 rounded-full border-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
          enabled ? 'bg-amber-500 border-amber-500' : 'bg-slate-700 border-slate-600'
        }`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg px-4 py-2.5 text-sm bg-slate-800/80 text-white border border-slate-700 hover:border-slate-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── NumberInput ───────────────────────────────────────────────────────────────

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <Input
      label={label}
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      hint={hint}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

// ── Section Heading ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 mt-2">
      {children}
    </h3>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoomSettingsPage() {
  const params   = useParams<{ roomCode: string }>();
  const roomCode = params?.roomCode ?? '';
  const router   = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [room, setRoom]               = useState<Room | null>(null);
  const [settings, setSettings]       = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [saved, setSaved]             = useState(false);

  // ── Fetch ──

  useEffect(() => {
    if (authLoading || !roomCode) return;

    async function fetchRoom() {
      const supabase = getSupabaseBrowser();
      const { data, error: err } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode)
        .single();

      if (err || !data) {
        setError('Room not found.');
        setPageLoading(false);
        return;
      }

      const fetchedRoom = data as Room;
      setRoom(fetchedRoom);
      setSettings({ ...DEFAULT_ROOM_SETTINGS, ...fetchedRoom.settings });
      setPageLoading(false);
    }

    fetchRoom();
  }, [authLoading, roomCode]);

  // ── Guard: host only ──
  useEffect(() => {
    if (!pageLoading && room && user && room.host_user_id !== user.id) {
      router.replace(`/room/${roomCode}`);
    }
  }, [pageLoading, room, user, roomCode, router]);

  // ── Helpers ──

  function updateSettings<K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updateComposition<K extends keyof RoomSettings['composition_rules']>(
    key: K,
    value: RoomSettings['composition_rules'][K],
  ) {
    setSettings((prev) => ({
      ...prev,
      composition_rules: { ...prev.composition_rules, [key]: value },
    }));
  }

  // ── Save ──

  async function handleSave() {
    if (!room) return;
    setSaving(true);
    setError('');

    const supabase = getSupabaseBrowser();
    const { error: saveErr } = await supabase
      .from('rooms')
      .update({ settings })
      .eq('id', room.id);

    if (saveErr) {
      setError(saveErr.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  // ── Loading / Error states ──

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center gap-4">
        <p className="text-4xl" aria-hidden="true">⚙️</p>
        <p className="text-xl font-semibold text-white">{error}</p>
        <Link href="/dashboard">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-purple-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* ── Header ── */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/room/${roomCode}`}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Back to lobby"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">Room Settings</h1>
            <p className="text-sm text-slate-400">{room.name} &middot; {room.room_code}</p>
          </div>
        </div>

        {/* ── Form ── */}
        <div className="flex flex-col gap-6">
          {/* Budget & Capacity */}
          <Card>
            <CardHeader>
              <h2 className="font-bold text-white">Budget &amp; Capacity</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <NumberField
                label="Budget (Cr)"
                value={settings.budget}
                min={10}
                max={1000}
                step={10}
                hint={`Current: ${formatCurrency(settings.budget)} per team`}
                onChange={(v) => updateSettings('budget', v)}
              />

              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label="Squad Size Min"
                  value={settings.squad_size_min}
                  min={1}
                  max={settings.squad_size_max}
                  onChange={(v) => updateSettings('squad_size_min', v)}
                />
                <NumberField
                  label="Squad Size Max"
                  value={settings.squad_size_max}
                  min={settings.squad_size_min}
                  max={30}
                  onChange={(v) => updateSettings('squad_size_max', v)}
                />
              </div>

              <NumberField
                label="Max Teams (Players)"
                value={settings.max_players}
                min={2}
                max={12}
                onChange={(v) => updateSettings('max_players', v)}
              />
            </CardBody>
          </Card>

          {/* Auction Settings */}
          <Card>
            <CardHeader>
              <h2 className="font-bold text-white">Auction Settings</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <SelectField<AuctionMode>
                label="Auction Mode"
                value={settings.auction_mode}
                options={[
                  { value: 'live_auction', label: 'Live Auction' },
                  { value: 'snake_draft',  label: 'Snake Draft'  },
                ]}
                onChange={(v) => updateSettings('auction_mode', v)}
              />

              <SelectField<string>
                label="Bid Increment (Cr)"
                value={String(settings.bid_increment)}
                options={[
                  { value: '0.25', label: '0.25 Cr' },
                  { value: '0.5',  label: '0.50 Cr' },
                  { value: '1',    label: '1.00 Cr' },
                ]}
                onChange={(v) => updateSettings('bid_increment', Number(v))}
              />

              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label="Auction Timer (s)"
                  value={settings.timer_seconds}
                  min={5}
                  max={120}
                  step={5}
                  onChange={(v) => updateSettings('timer_seconds', v)}
                />
                <NumberField
                  label="Draft Timer (s)"
                  value={settings.draft_timer_seconds}
                  min={10}
                  max={300}
                  step={10}
                  onChange={(v) => updateSettings('draft_timer_seconds', v)}
                />
              </div>

              <SelectField<RoomSettings['player_order']>
                label="Player Order"
                value={settings.player_order}
                options={[
                  { value: 'random',     label: 'Random'              },
                  { value: 'price_desc', label: 'Price (High to Low)' },
                  { value: 'by_role',    label: 'By Role'             },
                ]}
                onChange={(v) => updateSettings('player_order', v)}
              />
            </CardBody>
          </Card>

          {/* Composition Rules */}
          <Card>
            <CardHeader>
              <h2 className="font-bold text-white">Composition Rules</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Toggle
                enabled={settings.composition_rules.enabled}
                onChange={(v) => updateComposition('enabled', v)}
                label="Enable Composition Rules"
                description="Enforce squad composition requirements during auction"
              />

              {settings.composition_rules.enabled && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <NumberField
                    label="Max Overseas"
                    value={settings.composition_rules.max_overseas}
                    min={0}
                    max={11}
                    onChange={(v) => updateComposition('max_overseas', v)}
                  />
                  <NumberField
                    label="Min Wicketkeepers"
                    value={settings.composition_rules.min_wicketkeepers}
                    min={0}
                    max={4}
                    onChange={(v) => updateComposition('min_wicketkeepers', v)}
                  />
                  <NumberField
                    label="Min Batters"
                    value={settings.composition_rules.min_batters}
                    min={0}
                    max={8}
                    onChange={(v) => updateComposition('min_batters', v)}
                  />
                  <NumberField
                    label="Min Bowlers"
                    value={settings.composition_rules.min_bowlers}
                    min={0}
                    max={8}
                    onChange={(v) => updateComposition('min_bowlers', v)}
                  />
                  <NumberField
                    label="Min All-Rounders"
                    value={settings.composition_rules.min_allrounders}
                    min={0}
                    max={6}
                    onChange={(v) => updateComposition('min_allrounders', v)}
                  />
                </div>
              )}
            </CardBody>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <h2 className="font-bold text-white">Advanced</h2>
            </CardHeader>
            <CardBody>
              <Toggle
                enabled={settings.rtm_enabled}
                onChange={(v) => updateSettings('rtm_enabled', v)}
                label="Right to Match (RTM)"
                description="Allow teams to match the final bid and retain a player"
              />

              <div className="pt-3">
                <SelectField<RoomSettings['trade_window']>
                  label="Trade Window"
                  value={settings.trade_window}
                  options={[
                    { value: 'always',           label: 'Always Open'       },
                    { value: 'between_matches',   label: 'Between Matches'   },
                    { value: 'closed',            label: 'Closed'            },
                  ]}
                  onChange={(v) => updateSettings('trade_window', v)}
                />
              </div>

              <div className="pt-4">
                <Toggle
                  enabled={settings.commissioner_mode}
                  onChange={(v) => updateSettings('commissioner_mode', v)}
                  label="Commissioner Mode"
                  description="Host can override bids and manually assign players"
                />
              </div>
            </CardBody>
          </Card>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-500/40 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Saved confirmation */}
          {saved && (
            <div className="rounded-lg bg-emerald-900/30 border border-emerald-500/40 px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              Settings saved successfully.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pb-8">
            <Link href={`/room/${roomCode}`} className="flex-1">
              <Button variant="ghost" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button onClick={handleSave} loading={saving} className="flex-2 flex-1">
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
