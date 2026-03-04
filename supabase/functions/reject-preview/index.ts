import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

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
      .from('video_jobs').select('id, status').eq('id', jobId).single();

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

    await db.from('video_jobs').update({
      status: 'failed',
      error_message: 'Preview rejected by user',
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    console.log(`[reject-preview] jobId=${jobId} marked as failed`);

    return new Response(
      JSON.stringify({ jobId, status: 'failed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[reject-preview]', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
