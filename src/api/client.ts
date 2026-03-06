import type {
  GenerateVideoAPIRequest,
  GenerateVideoAPIResponse,
  JobStatusAPIResponse,
  AvatarListResponse,
  VoiceListResponse,
  CreditBalanceResponse,
} from '../types/api';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

class EZVidsApiClient {
  private async getAccessToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    return session.access_token;
  }

  private async invoke<T>(functionName: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${FUNCTIONS_BASE}/${functionName}`;

    console.log(`[EZVids API] POST ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'x-user-token': token,
      },
      body: JSON.stringify(body ?? {}),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }

    return res.json();
  }

  /** Submit a video generation request */
  generateVideo(input: GenerateVideoAPIRequest) {
    return this.invoke<GenerateVideoAPIResponse>('generate-video', input);
  }

  /** Approve a preview and trigger full render */
  renderVideo(jobId: string) {
    return this.invoke<GenerateVideoAPIResponse>('render-video', { jobId });
  }

  /** Reject a preview — marks the job as failed */
  rejectPreview(jobId: string) {
    return this.invoke<{ jobId: string; status: string }>('reject-preview', { jobId });
  }

  /** Poll job status */
  getJobStatus(jobId: string) {
    return this.invoke<JobStatusAPIResponse>('job-status', { jobId });
  }

  /** List available avatars (cached server-side) */
  getAvatars() {
    return this.invoke<AvatarListResponse>('list-avatars');
  }

  /** List available TTS voices (cached server-side) */
  getVoices() {
    return this.invoke<VoiceListResponse>('list-voices');
  }

  /** List all jobs for the current user */
  getJobs() {
    return this.invoke<{ jobs: JobStatusAPIResponse[] }>('list-jobs');
  }

  /** Upload a product image and get its public URL */
  uploadProductImage(base64: string, mimeType?: string) {
    return this.invoke<{ url: string }>('upload-product-image', { base64, mimeType });
  }

  /** Get remaining Creatify credits */
  getCreditBalance() {
    return this.invoke<CreditBalanceResponse>('credit-balance');
  }

  /** Health check — verify Edge Functions are reachable */
  health() {
    return this.invoke<{ service: string; status: string }>('health');
  }
}

export const api = new EZVidsApiClient();
