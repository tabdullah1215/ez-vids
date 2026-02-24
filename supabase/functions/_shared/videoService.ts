import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { VideoRequest, VideoJob } from './types/video.ts';

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  }
  return createClient(url, key);
}

export class VideoService {
  /**
   * Insert a new job as 'pending' — no Creatify call.
   * The submit-worker cron picks it up and submits to Creatify.
   */
  async createJob(userId: string, request: VideoRequest): Promise<VideoJob> {
    const db = getSupabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const job: VideoJob = {
      id, userId, status: 'pending', request,
      createdAt: now, updatedAt: now,
    };

    const { error } = await db.from('video_jobs').insert({
      id: job.id,
      user_id: job.userId,
      status: job.status,
      request: job.request,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
    });

    if (error) throw new Error(`DB insert: ${error.message}`);

    return job;
  }

  /**
   * Read job status from DB only — no Creatify call.
   * The poll-worker cron handles Creatify status checks and updates the DB.
   */
  async refreshJobStatus(jobId: string): Promise<VideoJob | null> {
    const db = getSupabase();

    const { data: row, error } = await db
      .from('video_jobs').select('*').eq('id', jobId).single();

    if (error || !row) return null;

    return this.toJob(row);
  }

  private toJob(r: Record<string, unknown>): VideoJob {
    return {
      id: r.id as string,
      userId: r.user_id as string,
      providerJobId: r.provider_job_id as string | undefined,
      status: r.status as VideoJob['status'],
      request: r.request as VideoJob['request'],
      videoUrl: r.video_url as string | undefined,
      thumbnailUrl: r.thumbnail_url as string | undefined,
      creditsUsed: r.credits_used as number | undefined,
      errorMessage: r.error_message as string | undefined,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      completedAt: r.completed_at as string | undefined,
    };
  }
}

export const videoService = new VideoService();
