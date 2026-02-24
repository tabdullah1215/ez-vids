/** How the voice/audio is sourced */
export type VoiceMode = 'user_audio' | 'tts';

/** Job lifecycle states */
export type JobStatus =
  | 'pending'
  | 'created'
  | 'submitted'
  | 'queued'
  | 'rendering'
  | 'completed'
  | 'failed';

/** Core video generation request — what the app assembles */
export interface VideoRequest {
  scriptText?: string;
  audioUrl?: string;
  voiceMode: VoiceMode;
  avatarId: string;
  voiceId?: string;
  productImageUrl?: string;
  productName?: string;
  aspectRatio: '9:16' | '1:1' | '16:9';
  captions: {
    enabled: boolean;
    style?: string;
  };
}

/** What we store per job in Supabase */
export interface VideoJob {
  id: string;
  userId: string;
  providerJobId?: string;
  status: JobStatus;
  request: VideoRequest;
  videoUrl?: string;
  thumbnailUrl?: string;
  creditsUsed?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
