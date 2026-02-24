import type { VideoProvider } from './videoProvider.ts';
import type { VideoRequest, JobStatus } from './types/video.ts';

/** Thrown when Creatify returns HTTP 429 — workers should stop the batch early. */
export class RateLimitedError extends Error {
  constructor(endpoint: string) {
    super(`Creatify rate limited on ${endpoint}`);
    this.name = 'RateLimitedError';
  }
}

const CREATIFY_BASE =
  Deno.env.get('CREATIFY_BASE_URL') || 'https://api.creatify.ai';

function headers(): Record<string, string> {
  const id = Deno.env.get('CREATIFY_API_ID');
  const key = Deno.env.get('CREATIFY_API_KEY');
  if (!id || !key) {
    throw new Error(
      'Missing CREATIFY_API_ID or CREATIFY_API_KEY env vars. ' +
      'Set them in supabase/functions/.env or Supabase dashboard secrets.'
    );
  }
  return {
    'Content-Type': 'application/json',
    'X-API-ID': id,
    'X-API-KEY': key,
  };
}

function mapStatus(s: string): JobStatus {
  switch (s?.toLowerCase()) {
    case 'pending':
    case 'queued':
      return 'queued';
    case 'processing':
    case 'rendering':
      return 'rendering';
    case 'done':
    case 'completed':
      return 'completed';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'submitted';
  }
}

/** Creatify uses "9x16" not "9:16" */
function fmtRatio(r: string): string {
  return r.replace(':', 'x');
}

export const creatifyProvider: VideoProvider = {
  name: 'creatify',

  async createJob(req: VideoRequest) {
    const payload: Record<string, unknown> = {
      creator: req.avatarId,
      aspect_ratio: fmtRatio(req.aspectRatio),
      no_caption: !req.captions.enabled,
    };

    if (req.captions.enabled && req.captions.style) {
      payload.caption_style = req.captions.style;
    }

    // Voice branching: user audio vs TTS
    if (req.voiceMode === 'user_audio' && req.audioUrl) {
      payload.audio = req.audioUrl;
    } else {
      payload.text = req.scriptText;
      if (req.voiceId) payload.accent = req.voiceId;
    }

    if (req.productImageUrl) {
      payload.background_asset_image_url = req.productImageUrl;
    }

    const res = await fetch(`${CREATIFY_BASE}/api/lipsyncs/`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    });

    if (res.status === 429) throw new RateLimitedError('createJob');
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Creatify createJob ${res.status}: ${err}`);
    }

    const data = await res.json();
    return {
      providerJobId: data.id,
      status: mapStatus(data.status || 'pending'),
    };
  },

  async checkJobStatus(providerJobId: string) {
    const res = await fetch(
      `${CREATIFY_BASE}/api/lipsyncs/${providerJobId}/`,
      { method: 'GET', headers: headers() }
    );

    if (res.status === 429) throw new RateLimitedError('checkJobStatus');
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Creatify checkStatus ${res.status}: ${err}`);
    }

    const d = await res.json();
    return {
      status: mapStatus(d.status),
      videoUrl: d.output || undefined,
      thumbnailUrl: d.video_thumbnail || undefined,
      creditsUsed: d.credits_used || undefined,
      progress: d.progress || undefined,
      errorMessage: d.failed_reason || undefined,
    };
  },

  async listAvatars() {
    const res = await fetch(`${CREATIFY_BASE}/api/personas/`, {
      method: 'GET',
      headers: headers(),
    });
    if (res.status === 429) throw new RateLimitedError('listAvatars');
    if (!res.ok) throw new Error(`listAvatars ${res.status}`);

    const data = await res.json();
    const list = Array.isArray(data) ? data : data.results || [];
    return list.map((p: Record<string, unknown>) => ({
      id: p.id as string,
      name: (p.creator_name as string) || (p.name as string) || 'Unnamed',
      gender: p.gender as string | undefined,
      previewUrl: (p.preview_image_1_1 || p.preview_image_9_16 || p.preview_image_16_9) as string | undefined,
    }));
  },

  async listVoices() {
    const res = await fetch(`${CREATIFY_BASE}/api/voices/`, {
      method: 'GET',
      headers: headers(),
    });
    if (res.status === 429) throw new RateLimitedError('listVoices');
    if (!res.ok) throw new Error(`listVoices ${res.status}`);

    const data = await res.json();
    const out: Array<{
      id: string; name: string; gender?: string;
      accentName?: string; previewUrl?: string;
    }> = [];

    for (const v of data) {
      for (const a of (v.accents || []) as Array<Record<string, unknown>>) {
        out.push({
          id: a.id as string,
          name: v.name as string,
          gender: v.gender as string | undefined,
          accentName: a.accent_name as string | undefined,
          previewUrl: a.preview_url as string | undefined,
        });
      }
    }
    return out;
  },
};
