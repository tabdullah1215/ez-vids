import type { VercelRequest, VercelResponse } from '@vercel/node';
import { creatifyProvider } from '../../lib/creatifyProvider';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const voices = await creatifyProvider.listVoices();

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    return res.status(200).json({ voices });

  } catch (err) {
    console.error('[GET /api/voices]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
