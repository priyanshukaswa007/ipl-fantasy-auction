import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client (for client components)
export function createSupabaseBrowser() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Server client (for API routes / server components)
export function createSupabaseServer() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Admin client (for server-side operations that need service role)
export function createSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Singleton browser client for hooks
let browserClient: ReturnType<typeof createSupabaseBrowser> | null = null;

export function getSupabaseBrowser() {
  if (!browserClient) {
    browserClient = createSupabaseBrowser();
  }
  return browserClient;
}
