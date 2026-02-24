import type { VoiceMode, JobStatus } from './video.ts';

/** POST /functions/v1/generate-video — client sends this */
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
}

/** POST /functions/v1/generate-video — server returns this */
export interface GenerateVideoAPIResponse {
  jobId: string;
  status: JobStatus;
}

/** GET /functions/v1/job-status?jobId=... — server returns this */
export interface JobStatusAPIResponse {
  jobId: string;
  status: JobStatus;
  videoUrl?: string;
  thumbnailUrl?: string;
  creditsUsed?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/** GET /functions/v1/list-avatars — server returns this */
export interface AvatarListResponse {
  avatars: Array<{
    id: string;
    name: string;
    gender?: string;
    previewUrl?: string;
  }>;
}

/** GET /functions/v1/list-voices — server returns this */
export interface VoiceListResponse {
  voices: Array<{
    id: string;
    name: string;
    gender?: string;
    accentName?: string;
    previewUrl?: string;
  }>;
}
