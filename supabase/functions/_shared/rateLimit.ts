import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key);
}

/**
 * Atomically acquire API call slots for a specific caller.
 * Uses a Postgres function with SELECT ... FOR UPDATE — no TOCTOU race.
 * Returns the number of slots granted (0 if rate-limited).
 */
export async function acquireSlots(api: string, caller: string, requested: number): Promise<number> {
  const db = getSupabase();

  const { data, error } = await db.rpc('acquire_api_slots', {
    p_api: api,
    p_caller: caller,
    p_requested: requested,
  });

  if (error) {
    console.error('[rateLimit] RPC error:', error.message);
    return 0;
  }

  return data ?? 0;
}
