import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { creatifyProvider } from '../_shared/creatifyProvider.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { remainingCredits } = await creatifyProvider.getCreditBalance();

    return new Response(
      JSON.stringify({ remainingCredits }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[credit-balance]', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
