import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key);
}

/**
 * Attempt to acquire `requested` API call slots from the shared rate limit table.
 * Returns the number of slots actually granted (may be less than requested, or 0 if capped).
 *
 * Both submit-worker and poll-worker call this before touching Creatify,
 * so their combined calls never exceed max_calls per window_secs.
 */
export async function acquireSlots(api: string, requested: number): Promise<number> {
  const db = getSupabase();
  const now = new Date();

  const { data, error } = await db
    .from('api_rate_limits')
    .select('*')
    .eq('api', api)
    .single();

  if (error || !data) {
    console.error('[rateLimit] Failed to read rate limit row:', error?.message);
    return 0;
  }

  const windowStart = new Date(data.window_start);
  const windowExpired =
    (now.getTime() - windowStart.getTime()) / 1000 > data.window_secs;

  if (windowExpired) {
    // Reset window — grant up to requested (new window starts now)
    const granted = Math.min(requested, data.max_calls);
    await db.from('api_rate_limits').update({
      window_start: now.toISOString(),
      calls_made: granted,
    }).eq('api', api);
    return granted;
  }

  const remaining = data.max_calls - data.calls_made;
  const granted = Math.min(remaining, requested);

  if (granted > 0) {
    await db.from('api_rate_limits').update({
      calls_made: data.calls_made + granted,
    }).eq('api', api);
  }

  return granted;
}
