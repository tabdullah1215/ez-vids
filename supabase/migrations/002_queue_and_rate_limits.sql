-- EZVids Migration 002: Queue + Rate Limiting
-- Adds 'pending' status, api_rate_limits table, and pg_cron schedules.
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run

-- ─────────────────────────────────────────────
-- 1. Add 'pending' to video_jobs status CHECK
-- ─────────────────────────────────────────────
ALTER TABLE video_jobs DROP CONSTRAINT IF EXISTS video_jobs_status_check;

ALTER TABLE video_jobs ADD CONSTRAINT video_jobs_status_check
  CHECK (status IN (
    'pending', 'created', 'submitted', 'queued',
    'rendering', 'completed', 'failed'
  ));

-- Update index to include 'pending' in active jobs
DROP INDEX IF EXISTS idx_video_jobs_active;
CREATE INDEX idx_video_jobs_active
  ON video_jobs (status)
  WHERE status IN ('pending', 'created', 'submitted', 'queued', 'rendering');

-- ─────────────────────────────────────────────
-- 2. Rate limit table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_rate_limits (
  api          TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calls_made   INT NOT NULL DEFAULT 0,
  max_calls    INT NOT NULL,
  window_secs  INT NOT NULL
);

-- Seed: 60 Creatify calls per 60 seconds (adjust to match your Creatify plan)
INSERT INTO api_rate_limits (api, window_start, calls_made, max_calls, window_secs)
VALUES ('creatify', NOW(), 0, 60, 60)
ON CONFLICT (api) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. pg_cron schedules (requires pg_cron extension)
--    Enable it first: Supabase Dashboard → Database → Extensions → pg_cron
--    And pg_net: Extensions → pg_net
-- ─────────────────────────────────────────────

-- Submit worker: every 1 minute (pg_cron minimum granularity — no sub-minute support)
SELECT cron.schedule(
  'submit-worker',
  '* * * * *',
  $$
    SELECT net.http_post(
      url    := 'https://vbwrwscbyxgxdeseokxs.supabase.co/functions/v1/submit-worker',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZid3J3c2NieXhneGRlc2Vva3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDQxMTMsImV4cCI6MjA4NzQyMDExM30.YcwqMpWvC8SlRHeASd_PQlXGnHc2ElGK9vwtxQWxb0o"}'::jsonb,
      body   := '{}'::jsonb
    );
  $$
);

-- Poll worker: every 1 minute
SELECT cron.schedule(
  'poll-worker',
  '* * * * *',
  $$
    SELECT net.http_post(
      url    := 'https://vbwrwscbyxgxdeseokxs.supabase.co/functions/v1/poll-worker',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZid3J3c2NieXhneGRlc2Vva3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDQxMTMsImV4cCI6MjA4NzQyMDExM30.YcwqMpWvC8SlRHeASd_PQlXGnHc2ElGK9vwtxQWxb0o"}'::jsonb,
      body   := '{}'::jsonb
    );
  $$
);

-- Verify cron jobs registered:
-- SELECT * FROM cron.job;

-- To remove cron jobs if needed:
-- SELECT cron.unschedule('submit-worker');
-- SELECT cron.unschedule('poll-worker');
