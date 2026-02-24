import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { creatifyProvider } from '../_shared/creatifyProvider.ts';
import { acquireSlots } from '../_shared/rateLimit.ts';

const BATCH_SIZE = 5; // max jobs to submit per run

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const db = getSupabase();

    // Check for pending jobs first — only consume rate limit slots if there's actual work
    const { data: candidates, error: selectErr } = await db
      .from('video_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (selectErr) throw new Error(`DB select: ${selectErr.message}`);
    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ submitted: 0, reason: 'no_pending_jobs' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Now acquire only as many slots as we actually need
    const slots = await acquireSlots('creatify', candidates.length);

    if (slots === 0) {
      console.log('[submit-worker] Rate limit reached — skipping run');
      return new Response(
        JSON.stringify({ submitted: 0, reason: 'rate_limited' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const jobs = candidates.slice(0, slots);

    let submitted = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        const result = await creatifyProvider.createJob(job.request);

        await db.from('video_jobs').update({
          provider_job_id: result.providerJobId,
          status: result.status,
          updated_at: new Date().toISOString(),
        }).eq('id', job.id);

        submitted++;
      } catch (err) {
        console.error(`[submit-worker] Failed to submit job ${job.id}:`, err);

        await db.from('video_jobs').update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Submission failed',
          updated_at: new Date().toISOString(),
        }).eq('id', job.id);

        failed++;
      }
    }

    console.log(`[submit-worker] submitted=${submitted} failed=${failed} slots=${slots}`);

    return new Response(
      JSON.stringify({ submitted, failed, slots }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[submit-worker]', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
