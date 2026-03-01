import type { VideoRequest, JobStatus } from './types/video.ts';

/**
 * Abstract video generation provider interface.
 * Implement this to swap Creatify for HeyGen, Synthesia, etc.
 */
export interface VideoProvider {
  readonly name: string;

  createJob(request: VideoRequest): Promise<{
    providerJobId: string;
    status: JobStatus;
  }>;

  checkJobStatus(providerJobId: string): Promise<{
    status: JobStatus;
    videoUrl?: string;
    thumbnailUrl?: string;
    creditsUsed?: number;
    progress?: string;
    errorMessage?: string;
  }>;

  listAvatars(): Promise<Array<{
    id: string;
    name: string;
    gender?: string;
    previewUrl?: string;
  }>>;

  listVoices(): Promise<Array<{
    id: string;
    name: string;
    gender?: string;
    accentName?: string;
    previewUrl?: string;
  }>>;

  listTemplates(): Promise<Array<{
    id: string;
    name: string;
    description?: string;
    thumbnailUrl?: string;
  }>>;

  createTemplateJob(templateId: string, variables: Record<string, unknown>): Promise<{
    providerJobId: string;
    status: JobStatus;
  }>;

  checkTemplateJobStatus(providerJobId: string): Promise<{
    status: JobStatus;
    videoUrl?: string;
    thumbnailUrl?: string;
    creditsUsed?: number;
    progress?: string;
    errorMessage?: string;
  }>;
}
