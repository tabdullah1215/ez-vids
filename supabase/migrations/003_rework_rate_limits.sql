-- EZVids Migration 003: Rework Rate Limits
-- Separate per-worker budgets, atomic slot acquisition via Postgres function.
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run

-- ─────────────────────────────────────────────
-- 1. Drop old table and recreate with composite PK
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS api_rate_limits;

CREATE TABLE api_rate_limits (
  api          TEXT NOT NULL,
  caller       TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calls_made   INT NOT NULL DEFAULT 0,
  max_calls    INT NOT NULL,
  window_secs  INT NOT NULL,
  PRIMARY KEY (api, caller)
);

-- Seed: separate budgets per worker
INSERT INTO api_rate_limits (api, caller, window_start, calls_made, max_calls, window_secs)
VALUES
  ('creatify', 'submit-worker', NOW(), 0, 15, 60),
  ('creatify', 'poll-worker',   NOW(), 0, 25, 60);

-- ─────────────────────────────────────────────
-- 2. Atomic slot acquisition function
--    Uses SELECT ... FOR UPDATE to eliminate TOCTOU race.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION acquire_api_slots(
  p_api       TEXT,
  p_caller    TEXT,
  p_requested INT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_row       api_rate_limits%ROWTYPE;
  v_now       TIMESTAMPTZ := NOW();
  v_granted   INT;
  v_remaining INT;
BEGIN
  -- Lock the row for this api+caller
  SELECT * INTO v_row
    FROM api_rate_limits
   WHERE api = p_api AND caller = p_caller
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Check if window has expired
  IF EXTRACT(EPOCH FROM (v_now - v_row.window_start)) > v_row.window_secs THEN
    -- Reset window, grant up to requested (capped by max_calls)
    v_granted := LEAST(p_requested, v_row.max_calls);
    UPDATE api_rate_limits
       SET window_start = v_now,
           calls_made   = v_granted
     WHERE api = p_api AND caller = p_caller;
    RETURN v_granted;
  END IF;

  -- Window still active — grant remaining capacity
  v_remaining := v_row.max_calls - v_row.calls_made;
  v_granted   := LEAST(p_requested, v_remaining);

  IF v_granted > 0 THEN
    UPDATE api_rate_limits
       SET calls_made = v_row.calls_made + v_granted
     WHERE api = p_api AND caller = p_caller;
  END IF;

  RETURN v_granted;
END;
$$;
