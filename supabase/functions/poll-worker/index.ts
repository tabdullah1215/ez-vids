import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { creatifyProvider, RateLimitedError } from '../_shared/creatifyProvider.ts';
import { acquireSlots } from '../_shared/rateLimit.ts';

const BATCH_SIZE = 25; // max jobs to poll per run
const ACTIVE_STATUSES = ['submitted', 'queued', 'rendering'];

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

    // Check for active jobs first — only consume rate limit slots if there's actual work
    const { data: candidates, error: selectErr } = await db
      .from('video_jobs')
      .select('*')
      .in('status', ACTIVE_STATUSES)
      .order('updated_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (selectErr) throw new Error(`DB select: ${selectErr.message}`);
    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ polled: 0, reason: 'no_active_jobs' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Now acquire only as many slots as we actually need
    const slots = await acquireSlots('creatify', 'poll-worker', candidates.length);

    if (slots === 0) {
      console.log('[poll-worker] Rate limit reached — skipping run');
      return new Response(
        JSON.stringify({ polled: 0, reason: 'rate_limited' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const jobs = candidates.slice(0, slots);

    let polled = 0;
    let completed = 0;
    let failed = 0;

    for (const job of jobs) {
      if (!job.provider_job_id) continue;

      try {
        const result = await creatifyProvider.checkJobStatus(job.provider_job_id);

        const isPreviewJob = job.job_mode === 'preview';
        console.log(`[poll-worker] Job ${job.id}: job_mode=${job.job_mode}, creatify_status=${result.status}, previewUrl=${result.previewUrl || 'none'}, videoUrl=${result.videoUrl || 'none'}`);

        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (isPreviewJob && result.previewUrl) {
          // Preview URL is available — park as preview_ready
          updates.status = 'preview_ready';
          updates.preview_url = result.previewUrl;
          if (result.creditsUsed) updates.credits_used = result.creditsUsed;
          completed++;
        } else if (result.status === 'completed') {
          // Full render completed
          updates.status = 'completed';
          if (result.videoUrl) updates.video_url = result.videoUrl;
          if (result.thumbnailUrl) updates.thumbnail_url = result.thumbnailUrl;
          if (result.creditsUsed) updates.credits_used = result.creditsUsed;
          updates.completed_at = new Date().toISOString();
          completed++;
        } else if (result.status === 'failed') {
          updates.status = 'failed';
          if (result.errorMessage) updates.error_message = result.errorMessage;
          failed++;
        } else {
          updates.status = result.status;
        }

        await db.from('video_jobs').update(updates).eq('id', job.id);
        polled++;
      } catch (err) {
        if (err instanceof RateLimitedError) {
          console.warn(`[poll-worker] Creatify 429 — stopping batch early after ${polled} polls`);
          break;
        }
        console.error(`[poll-worker] Failed to check job ${job.id}:`, err);
        // Don't mark as failed — transient error, retry next run
      }
    }

    console.log(`[poll-worker] polled=${polled} completed=${completed} failed=${failed} slots=${slots}`);

    return new Response(
      JSON.stringify({ polled, completed, failed, slots }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[poll-worker]', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
