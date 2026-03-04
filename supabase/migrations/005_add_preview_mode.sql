-- EZVids Migration 005: Preview Mode
-- Adds job_mode column, preview_url column, and 'preview_ready' status.
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run

-- 1. Add job_mode column (render = direct generate, preview = preview-first flow)
ALTER TABLE video_jobs ADD COLUMN IF NOT EXISTS job_mode TEXT NOT NULL DEFAULT 'render';

-- 2. Add preview_url column (stores Creatify preview webpage URL)
ALTER TABLE video_jobs ADD COLUMN IF NOT EXISTS preview_url TEXT;

-- 3. Expand status constraint to include 'preview_ready'
ALTER TABLE video_jobs DROP CONSTRAINT IF EXISTS video_jobs_status_check;
ALTER TABLE video_jobs ADD CONSTRAINT video_jobs_status_check
  CHECK (status IN (
    'pending', 'created', 'submitted', 'queued',
    'rendering', 'preview_ready', 'completed', 'failed'
  ));
