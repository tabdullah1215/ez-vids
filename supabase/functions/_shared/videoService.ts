import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { VideoProvider } from './videoProvider.ts';
import type { VideoRequest, VideoJob } from './types/video.ts';

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.'
    );
  }
  return createClient(url, key);
}

export class VideoService {
  constructor(private provider: VideoProvider) {}

  async createJob(userId: string, request: VideoRequest): Promise<VideoJob> {
    const db = getSupabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const job: VideoJob = {
      id, userId, status: 'created', request,
      createdAt: now, updatedAt: now,
    };

    const { error: insErr } = await db.from('video_jobs').insert({
      id: job.id,
      user_id: job.userId,
      status: job.status,
      request: job.request,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
    });
    if (insErr) throw new Error(`DB insert: ${insErr.message}`);

    try {
      const result = await this.provider.createJob(request);

      const { error: updErr } = await db.from('video_jobs').update({
        provider_job_id: result.providerJobId,
        status: result.status,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (updErr) throw new Error(`DB update: ${updErr.message}`);

      return { ...job, providerJobId: result.providerJobId, status: result.status };
    } catch (err) {
      await db.from('video_jobs').update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      throw err;
    }
  }

  async refreshJobStatus(jobId: string): Promise<VideoJob | null> {
    const db = getSupabase();

    const { data: row, error } = await db
      .from('video_jobs').select('*').eq('id', jobId).single();

    if (error || !row) return null;
    if (row.status === 'completed' || row.status === 'failed') {
      return this.toJob(row);
    }
    if (!row.provider_job_id) return this.toJob(row);

    const result = await this.provider.checkJobStatus(row.provider_job_id);

    const updates: Record<string, unknown> = {
      status: result.status,
      updated_at: new Date().toISOString(),
    };
    if (result.videoUrl) updates.video_url = result.videoUrl;
    if (result.thumbnailUrl) updates.thumbnail_url = result.thumbnailUrl;
    if (result.creditsUsed) updates.credits_used = result.creditsUsed;
    if (result.errorMessage) updates.error_message = result.errorMessage;
    if (result.status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    await db.from('video_jobs').update(updates).eq('id', jobId);
    return this.toJob({ ...row, ...updates });
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
