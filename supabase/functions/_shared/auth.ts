import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Verify the Authorization header JWT and return the authenticated user ID.
 * Throws a Response with status 401 if missing or invalid.
 */
export async function getAuthenticatedUser(req: Request): Promise<string> {
  // User JWT is sent via x-user-token header (not Authorization).
  // The Authorization header carries the anon key for the Supabase gateway,
  // which only verifies HS256 tokens — user JWTs use ES256.
  const token = req.headers.get('x-user-token');
  if (!token) {
    throw new Response(
      JSON.stringify({ error: 'Missing x-user-token header' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return user.id;
}
