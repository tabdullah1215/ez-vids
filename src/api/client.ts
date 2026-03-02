import type {
  GenerateVideoAPIRequest,
  GenerateVideoAPIResponse,
  JobStatusAPIResponse,
  AvatarListResponse,
  VoiceListResponse,
  CreditBalanceResponse,
} from '../types/api';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

class EZVidsApiClient {
  private userId: string;

  constructor() {
    // MVP: hardcoded user. Replace with Supabase Auth session token.
    this.userId = 'mvp-test-user';
  }

  /** Update user ID after auth is implemented */
  setUserId(id: string) {
    this.userId = id;
  }

  private async invoke<T>(functionName: string, body?: unknown): Promise<T> {
    const url = `${FUNCTIONS_BASE}/${functionName}`;

    console.log(`[EZVids API] POST ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'x-user-id': this.userId,
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
