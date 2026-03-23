'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { User } from '@/types';

// ── Context shape ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (display_name: string, avatar_url: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Upserts the authenticated user into the public `users` table, then returns
 * the stored row so we always have the server-of-record data in state.
 */
async function syncUser(sessionUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Promise<User | null> {
  const supabase = getSupabaseBrowser();

  const google_id: string =
    (sessionUser.user_metadata?.provider_id as string | undefined) ??
    (sessionUser.user_metadata?.sub as string | undefined) ??
    sessionUser.id;

  const email = sessionUser.email ?? '';
  const display_name: string =
    (sessionUser.user_metadata?.full_name as string | undefined) ??
    (sessionUser.user_metadata?.name as string | undefined) ??
    email;
  const avatar_url: string | null =
    (sessionUser.user_metadata?.avatar_url as string | undefined) ??
    (sessionUser.user_metadata?.picture as string | undefined) ??
    null;

  const { error: upsertError } = await supabase.from('users').upsert(
    {
      id: sessionUser.id,
      google_id,
      email,
      display_name,
      avatar_url,
    },
    { onConflict: 'id' },
  );

  if (upsertError) {
    console.error('[auth-context] upsert error:', upsertError.message);
    return null;
  }

  const { data, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', sessionUser.id)
    .single();

  if (fetchError) {
    console.error('[auth-context] fetch error:', fetchError.message);
    return null;
  }

  return data as User;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  // Bootstrap: load existing session on mount
  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        const dbUser = await syncUser(session.user);
        if (mounted) setUser(dbUser);
      }

      if (mounted) setLoading(false);
    })();

    // Subscribe to future auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        const dbUser = await syncUser(session.user);
        setUser(dbUser);
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  }, [supabase, router]);

  const updateProfile = useCallback(
    async (display_name: string, avatar_url: string | null) => {
      if (!user) return;

      const { data, error } = await supabase
        .from('users')
        .update({ display_name, avatar_url })
        .eq('id', user.id)
        .select('*')
        .single();

      if (error) {
        console.error('[auth-context] updateProfile error:', error.message);
        return;
      }

      setUser(data as User);
    },
    [supabase, user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
