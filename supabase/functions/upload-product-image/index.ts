import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const MAX_BASE64_BYTES = 5 * 1024 * 1024; // 5 MB

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
    const userId = req.headers.get('x-user-id') || 'anonymous';
    const { base64, mimeType } = (await req.json()) as {
      base64: string;
      mimeType?: string;
    };

    if (!base64) {
      return new Response(
        JSON.stringify({ error: 'base64 field is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (base64.length > MAX_BASE64_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Image too large. Max 5 MB.' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Decode base64 to bytes
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const mime = mimeType || 'image/jpeg';
    const ext = mime === 'image/png' ? 'png' : 'jpg';
    const fileName = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const db = getSupabase();
    const { error: uploadError } = await db.storage
      .from('product-images')
      .upload(fileName, bytes, { contentType: mime, upsert: false });

    if (uploadError) {
      throw new Error(`Storage upload: ${uploadError.message}`);
    }

    const { data: urlData } = db.storage
      .from('product-images')
      .getPublicUrl(fileName);

    console.log(`[upload-product-image] uploaded ${fileName} for user ${userId}`);

    return new Response(
      JSON.stringify({ url: urlData.publicUrl }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[upload-product-image]', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
