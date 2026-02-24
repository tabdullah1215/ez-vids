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
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing x-user-id header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const db = getSupabase();

    const { data: rows, error } = await db
      .from('video_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`DB select: ${error.message}`);

    const jobs = (rows ?? []).map((r: Record<string, unknown>) => ({
      jobId:         r.id,
      status:        r.status,
      videoUrl:      r.video_url      ?? undefined,
      thumbnailUrl:  r.thumbnail_url  ?? undefined,
      creditsUsed:   r.credits_used   ?? undefined,
      errorMessage:  r.error_message  ?? undefined,
      request:       r.request,
      createdAt:     r.created_at,
      updatedAt:     r.updated_at,
      completedAt:   r.completed_at   ?? undefined,
    }));

    return new Response(
      JSON.stringify({ jobs }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[list-jobs]', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
