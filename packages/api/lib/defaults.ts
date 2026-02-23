import type { VoiceMode } from './types/video';

/**
 * MVP hardcoded defaults.
 * When user input is null/undefined, these are used.
 *
 * ⚠️  REPLACE avatar_id and voice_id with real IDs from:
 *     GET https://api.creatify.ai/api/personas/
 *     GET https://api.creatify.ai/api/voices/
 */
export const EZVIDS_DEFAULTS = {
  // --- Avatar ---
  avatarId: '18fccce8-86e7-5f31-abc8-18915cb872be',

  // --- Voice (TTS accent ID) ---
  voiceId: '6f8ca7a8-87b9-4f5d-905d-cc4598e79717',

  // --- Default script ---
  scriptText:
    'Check out this amazing product! It solves real problems and makes your life easier. Try it today!',

  // --- Product placeholder ---
  productImageUrl:
    'https://placehold.co/600x600/4F46E5/ffffff?text=Your+Product',

  // --- Locked for MVP ---
  aspectRatio: '9:16' as const,
  voiceMode: 'tts' as VoiceMode,

  // --- Captions ---
  captionsEnabled: true,
  captionStyle: 'normal-black',
} as const;
