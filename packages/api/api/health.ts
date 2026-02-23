import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const hasCreatify = !!(process.env.CREATIFY_API_ID && process.env.CREATIFY_API_KEY);
  const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  res.status(200).json({
    service: 'ezvids-api',
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      creatify: hasCreatify ? 'configured' : 'MISSING',
      supabase: hasSupabase ? 'configured' : 'MISSING',
    },
  });
}
