import { corsHeaders, handleCors } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  return new Response(
    JSON.stringify({
      service: 'ezvids-api',
      runtime: 'supabase-edge-functions',
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: {
        creatify: !!Deno.env.get('CREATIFY_API_ID') && !!Deno.env.get('CREATIFY_API_KEY'),
        supabase: !!Deno.env.get('SUPABASE_URL') && !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
