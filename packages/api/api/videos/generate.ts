import type { VercelRequest, VercelResponse } from '@vercel/node';
import { videoService } from '../../lib/serviceInstance';
import { EZVIDS_DEFAULTS } from '../../lib/defaults';
import type { GenerateVideoAPIRequest } from '../../lib/types/api';
import type { VideoRequest } from '../../lib/types/video';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body: GenerateVideoAPIRequest = req.body || {};

    // Auth — MVP: header-based user ID. Replace with Supabase JWT later.
    const userId = (req.headers['x-user-id'] as string) || 'mvp-test-user';

    // Merge user input with defaults
    const voiceMode = body.voiceMode || EZVIDS_DEFAULTS.voiceMode;

    const request: VideoRequest = {
      voiceMode,
      avatarId:        body.avatarId        || EZVIDS_DEFAULTS.avatarId,
      scriptText:      body.scriptText      || EZVIDS_DEFAULTS.scriptText,
      audioUrl:        body.audioUrl        || undefined,
      voiceId:         body.voiceId         || EZVIDS_DEFAULTS.voiceId,
      productImageUrl: body.productImageUrl || EZVIDS_DEFAULTS.productImageUrl,
      productName:     body.productName     || undefined,
      aspectRatio:     body.aspectRatio     || EZVIDS_DEFAULTS.aspectRatio,
      captions: {
        enabled: body.captionsEnabled ?? EZVIDS_DEFAULTS.captionsEnabled,
        style:   EZVIDS_DEFAULTS.captionStyle,
      },
    };

    // Validate
    if (voiceMode === 'tts' && !request.scriptText) {
      return res.status(400).json({ error: 'scriptText required for TTS mode' });
    }
    if (voiceMode === 'user_audio' && !request.audioUrl) {
      return res.status(400).json({ error: 'audioUrl required for user_audio mode' });
    }

    // Create job (Supabase insert + Creatify API call)
    const job = await videoService.createJob(userId, request);

    return res.status(201).json({
      jobId: job.id,
      status: job.status,
    });

  } catch (err) {
    console.error('[POST /api/videos/generate]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
