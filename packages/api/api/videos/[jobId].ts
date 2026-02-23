import type { VercelRequest, VercelResponse } from '@vercel/node';
import { videoService } from '../../lib/serviceInstance';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const jobId = req.query.jobId as string;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const job = await videoService.refreshJobStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Short cache for in-progress jobs, longer for terminal states
    const isTerminal = job.status === 'completed' || job.status === 'failed';
    res.setHeader(
      'Cache-Control',
      isTerminal ? 's-maxage=60' : 'no-cache'
    );

    return res.status(200).json({
      jobId:        job.id,
      status:       job.status,
      videoUrl:     job.videoUrl,
      thumbnailUrl: job.thumbnailUrl,
      creditsUsed:  job.creditsUsed,
      errorMessage: job.errorMessage,
      createdAt:    job.createdAt,
      updatedAt:    job.updatedAt,
      completedAt:  job.completedAt,
    });

  } catch (err) {
    console.error('[GET /api/videos/:jobId]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
