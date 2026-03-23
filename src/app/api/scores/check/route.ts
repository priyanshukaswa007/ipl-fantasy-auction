// ============================================================
// API Route: GET /api/scores/check
// Auto-checks for completed IPL matches and processes them.
// Called by cron job OR manually from admin panel.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentIPLMatches, mapTeamName } from '@/lib/cricapi';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // Optional: verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Allow without secret if CRON_SECRET not set (for manual testing)
      if (cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('[AutoCheck] Checking for completed IPL matches...');

    // 1. Fetch current IPL matches from CricAPI
    let iplMatches;
    try {
      iplMatches = await getCurrentIPLMatches();
    } catch (err: any) {
      return NextResponse.json({
        error: err.message,
        hint: 'Make sure CRICAPI_KEY is set in .env.local. Get a free key at https://cricketdata.org',
      }, { status: 500 });
    }

    console.log(`[AutoCheck] Found ${iplMatches.length} IPL matches from API`);

    // 2. Filter to completed matches only
    const completedMatches = iplMatches.filter((m) => m.matchEnded === true);
    console.log(`[AutoCheck] ${completedMatches.length} completed matches`);

    if (completedMatches.length === 0) {
      return NextResponse.json({
        message: 'No completed matches to process',
        total_ipl_matches: iplMatches.length,
        upcoming: iplMatches
          .filter((m) => !m.matchStarted)
          .map((m) => ({ name: m.name, date: m.date }))
          .slice(0, 5),
      });
    }

    // 3. Check which matches we've already processed
    const { data: existingMatches } = await supabase
      .from('match_results')
      .select('team_a, team_b, date')
      .eq('season', 'IPL 2026');

    const processedKeys = new Set(
      (existingMatches || []).map((m) => `${m.team_a}-${m.team_b}-${m.date}`)
    );

    // 4. Find new matches to process
    const newMatches = completedMatches.filter((m) => {
      const teamA = mapTeamName(m.teams?.[0] || '');
      const teamB = mapTeamName(m.teams?.[1] || '');
      const date = m.date?.split('T')?.[0] || '';
      const key1 = `${teamA}-${teamB}-${date}`;
      const key2 = `${teamB}-${teamA}-${date}`;
      return !processedKeys.has(key1) && !processedKeys.has(key2);
    });

    console.log(`[AutoCheck] ${newMatches.length} new matches to process`);

    if (newMatches.length === 0) {
      return NextResponse.json({
        message: 'All completed matches already processed',
        total_completed: completedMatches.length,
        already_processed: completedMatches.length,
      });
    }

    // 5. Process each new match by calling our /api/scores/update endpoint
    const results = [];
    const baseUrl = req.nextUrl.origin;
    const nextMatchNumber = (existingMatches?.length || 0) + 1;

    for (let i = 0; i < newMatches.length; i++) {
      const match = newMatches[i];

      try {
        const updateRes = await fetch(`${baseUrl}/api/scores/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            match_id: match.id,
            match_number: nextMatchNumber + i,
          }),
        });

        const updateData = await updateRes.json();
        results.push({
          match: match.name,
          status: updateRes.ok ? 'success' : 'error',
          ...updateData,
        });
      } catch (err: any) {
        results.push({
          match: match.name,
          status: 'error',
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} new match(es)`,
      results,
    });
  } catch (error: any) {
    console.error('[AutoCheck] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Auto-check failed' },
      { status: 500 }
    );
  }
}
