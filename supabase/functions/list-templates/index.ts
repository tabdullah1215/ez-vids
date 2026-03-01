import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { creatifyProvider } from '../_shared/creatifyProvider.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const templates = await creatifyProvider.listTemplates();

    return new Response(
      JSON.stringify({ templates }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      }
    );
  } catch (err) {
    console.error('[list-templates]', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
