import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { creatifyProvider, RateLimitedError } from '../_shared/creatifyProvider.ts';

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
    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'jobId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const db = getSupabase();

    const { data: row, error: selectErr } = await db
      .from('video_jobs').select('*').eq('id', jobId).single();

    if (selectErr || !row) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (row.status !== 'preview_ready') {
      return new Response(
        JSON.stringify({ error: `Job is not in preview_ready state (current: ${row.status})` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!row.provider_job_id) {
      return new Response(
        JSON.stringify({ error: 'Job has no provider_job_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Call Creatify render endpoint
    const result = await creatifyProvider.renderFromPreview(row.provider_job_id);

    // Switch to render mode so poll-worker treats next 'completed' as final
    await db.from('video_jobs').update({
      status: result.status,
      job_mode: 'render',
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    console.log(`[render-video] jobId=${jobId} providerStatus=${result.status}`);

    return new Response(
      JSON.stringify({ jobId, status: result.status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return new Response(
        JSON.stringify({ error: 'Rate limited — try again shortly' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    console.error('[render-video]', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
