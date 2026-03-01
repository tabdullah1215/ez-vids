import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { creatifyProvider } from '../_shared/creatifyProvider.ts';
import { VideoService } from '../_shared/videoService.ts';
import { EZVIDS_DEFAULTS } from '../_shared/defaults.ts';
import type { GenerateVideoAPIRequest } from '../_shared/types/api.ts';
import type { VideoRequest } from '../_shared/types/video.ts';

const service = new VideoService(creatifyProvider);

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const userId = req.headers.get('x-user-id') || 'anonymous';
    const body: GenerateVideoAPIRequest = await req.json();

    // Validate: TTS requires scriptText, user_audio requires audioUrl
    const voiceMode = body.voiceMode || EZVIDS_DEFAULTS.voiceMode;
    if (voiceMode === 'tts' && !body.scriptText && !EZVIDS_DEFAULTS.scriptText) {
      return new Response(
        JSON.stringify({ error: 'scriptText is required for TTS voice mode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (voiceMode === 'user_audio' && !body.audioUrl) {
      return new Response(
        JSON.stringify({ error: 'audioUrl is required for user_audio voice mode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const captionsEnabled = body.captionsEnabled ?? EZVIDS_DEFAULTS.captionsEnabled;

    const request: VideoRequest = {
      scriptText: body.scriptText || EZVIDS_DEFAULTS.scriptText,
      audioUrl: body.audioUrl,
      voiceMode,
      avatarId: body.avatarId || EZVIDS_DEFAULTS.avatarId,
      voiceId: body.voiceId || EZVIDS_DEFAULTS.voiceId,
      productImageUrl: body.productImageUrl || EZVIDS_DEFAULTS.productImageUrl,
      productName: body.productName,
      aspectRatio: body.aspectRatio || EZVIDS_DEFAULTS.aspectRatio,
      captions: {
        enabled: captionsEnabled,
        style: captionsEnabled ? EZVIDS_DEFAULTS.captionStyle : undefined,
      },
      visualStyle: body.visualStyle,
    };

    const job = await service.createJob(userId, request);

    return new Response(
      JSON.stringify({ jobId: job.id, status: job.status }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[generate-video]', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
