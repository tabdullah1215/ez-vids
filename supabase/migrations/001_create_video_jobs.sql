-- EZVids: Video Jobs Table
-- Stores all video generation requests and their lifecycle state.
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste → Run

CREATE TABLE IF NOT EXISTS video_jobs (
  id              UUID PRIMARY KEY,
  user_id         TEXT NOT NULL,
  provider_job_id TEXT,
  status          TEXT NOT NULL DEFAULT 'created'
                  CHECK (status IN (
                    'created','submitted','queued',
                    'rendering','completed','failed'
                  )),
  request         JSONB NOT NULL DEFAULT '{}'::jsonb,
  video_url       TEXT,
  thumbnail_url   TEXT,
  credits_used    INTEGER,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- Index: find all active (non-terminal) jobs for the polling worker
CREATE INDEX IF NOT EXISTS idx_video_jobs_active
  ON video_jobs (status)
  WHERE status IN ('created', 'submitted', 'queued', 'rendering');

-- Index: user's job history (newest first)
CREATE INDEX IF NOT EXISTS idx_video_jobs_user
  ON video_jobs (user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (protect against direct client access)
-- Backend uses service_role key which bypasses RLS.
-- These policies are for if you ever expose Supabase directly to the client.

CREATE POLICY "Users can read own jobs"
  ON video_jobs FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own jobs"
  ON video_jobs FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Verify: After running, check Table Editor for video_jobs table.
-- You should see all columns listed above.
