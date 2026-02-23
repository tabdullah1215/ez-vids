import type {
  GenerateVideoAPIRequest,
  GenerateVideoAPIResponse,
  JobStatusAPIResponse,
  AvatarListResponse,
  VoiceListResponse,
} from '../types/api';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

class EZVidsApiClient {
  private baseUrl: string;
  private userId: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // MVP: hardcoded user. Replace with Supabase Auth session token.
    this.userId = 'mvp-test-user';
  }

  /** Update user ID after auth is implemented */
  setUserId(id: string) {
    this.userId = id;
  }

  private async request<T>(path: string, opts?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    console.log(`[EZVids API] ${opts?.method || 'GET'} ${url}`);

    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': this.userId,
        ...opts?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API ${res.status}: ${body}`);
    }

    return res.json();
  }

  /** Submit a video generation request */
  generateVideo(input: GenerateVideoAPIRequest) {
    return this.request<GenerateVideoAPIResponse>('/videos/generate', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /** Poll job status */
  getJobStatus(jobId: string) {
    return this.request<JobStatusAPIResponse>(`/videos/${jobId}`);
  }

  /** List available avatars (cached server-side) */
  getAvatars() {
    return this.request<AvatarListResponse>('/avatars');
  }

  /** List available TTS voices (cached server-side) */
  getVoices() {
    return this.request<VoiceListResponse>('/voices');
  }

  /** Health check — verify API is reachable */
  health() {
    return this.request<{ service: string; status: string }>('/health');
  }
}

export const api = new EZVidsApiClient(API_BASE);
