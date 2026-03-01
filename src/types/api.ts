import type { VoiceMode, JobStatus } from './video';

/** POST /api/videos/generate — client sends this */
export interface GenerateVideoAPIRequest {
  scriptText?: string;
  audioUrl?: string;
  voiceMode?: VoiceMode;
  avatarId?: string;
  voiceId?: string;
  productImageUrl?: string;
  productName?: string;
  aspectRatio?: '9:16' | '1:1' | '16:9';
  captionsEnabled?: boolean;
  visualStyle?: string;
}

/** POST /api/videos/generate — server returns this */
export interface GenerateVideoAPIResponse {
  jobId: string;
  status: JobStatus;
}

/** GET /api/videos/:jobId — server returns this */
export interface JobStatusAPIResponse {
  jobId: string;
  status: JobStatus;
  videoUrl?: string;
  thumbnailUrl?: string;
  creditsUsed?: number;
  errorMessage?: string;
  request?: { scriptText?: string };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/** GET /api/avatars — server returns this */
export interface AvatarListResponse {
  avatars: Array<{
    id: string;
    name: string;
    gender?: string;
    previewUrl?: string;
  }>;
}

/** GET /api/voices — server returns this */
export interface VoiceListResponse {
  voices: Array<{
    id: string;
    name: string;
    gender?: string;
    accentName?: string;
    previewUrl?: string;
  }>;
}

