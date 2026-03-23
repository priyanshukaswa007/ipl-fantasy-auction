'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AuctionBoard } from '@/components/AuctionBoard';

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AuctionPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = params?.roomCode ?? '';
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  // Loading state while auth resolves
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in — redirect is in flight
  if (!user) return null;

  return <AuctionBoard roomCode={roomCode} />;
}
