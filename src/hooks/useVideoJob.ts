import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';
import type { GenerateVideoAPIRequest } from '../types/api';

export type JobPhase =
  | 'idle'
  | 'submitting'
  | 'polling'
  | 'preview_ready'
  | 'approving'
  | 'completed'
  | 'failed';

interface JobState {
  phase: JobPhase;
  jobId: string | null;
  providerStatus: string | null;
  videoUrl: string | null;
  previewUrl: string | null;
  error: string | null;
  elapsedSeconds: number;
}

const INITIAL_STATE: JobState = {
  phase: 'idle',
  jobId: null,
  providerStatus: null,
  videoUrl: null,
  previewUrl: null,
  error: null,
  elapsedSeconds: 0,
};

/** Adaptive backoff: 15s for first 3 min, 30s for 3-10 min, 60s after 10 min */
function getInterval(elapsedMs: number): number {
  if (elapsedMs < 3 * 60_000) return 15_000;
  if (elapsedMs < 10 * 60_000) return 30_000;
  return 60_000;
}

const MAX_POLL_DURATION_MS = 20 * 60_000; // 20 minutes
const MAX_CONSECUTIVE_ERRORS = 5;

/** Handle a poll result — returns true if terminal (stop polling) */
function handlePollResult(
  result: { status: string; videoUrl?: string; previewUrl?: string; errorMessage?: string },
  cleanup: () => void,
  setState: React.Dispatch<React.SetStateAction<JobState>>,
): boolean {
  setState((s) => ({
    ...s,
    providerStatus: result.status,
    videoUrl: result.videoUrl || s.videoUrl,
    previewUrl: result.previewUrl || s.previewUrl,
    error: result.errorMessage || null,
  }));

  if (result.status === 'preview_ready') {
    cleanup();
    setState((s) => ({
      ...s,
      phase: 'preview_ready',
      previewUrl: result.previewUrl || s.previewUrl,
    }));
    return true;
  } else if (result.status === 'completed') {
    cleanup();
    setState((s) => ({ ...s, phase: 'completed' }));
    return true;
  } else if (result.status === 'failed') {
    cleanup();
    setState((s) => ({
      ...s,
      phase: 'failed',
      error: result.errorMessage || 'Video generation failed',
    }));
    return true;
  }
  return false;
}

export function useVideoJob() {
  const [state, setState] = useState<JobState>(INITIAL_STATE);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const errCountRef = useRef(0);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollRef.current = null;
    timerRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  const startPolling = useCallback(
    (jobId: string) => {
      startRef.current = Date.now();
      errCountRef.current = 0;

      setState((s) => ({
        ...s,
        phase: 'polling',
        jobId,
        providerStatus: 'queued',
        videoUrl: null,
        error: null,
        elapsedSeconds: 0,
      }));

      // Elapsed timer (every 1s)
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
        setState((s) => ({ ...s, elapsedSeconds: elapsed }));
      }, 1000);

      const failPolling = (message: string) => {
        cleanup();
        setState((s) => ({ ...s, phase: 'failed', error: message }));
      };

      // Recursive poll with adaptive backoff
      const schedulePoll = () => {
        const elapsedMs = Date.now() - startRef.current;

        if (elapsedMs > MAX_POLL_DURATION_MS) {
          failPolling('Video generation timed out. Check My Videos for updates.');
          return;
        }

        const interval = getInterval(elapsedMs);

        pollRef.current = setTimeout(async () => {
          try {
            const result = await api.getJobStatus(jobId);
            errCountRef.current = 0; // reset on success
            if (handlePollResult(result, cleanup, setState)) return;
          } catch (err) {
            errCountRef.current++;
            console.warn(`[useVideoJob] poll error (${errCountRef.current}/${MAX_CONSECUTIVE_ERRORS}):`, err);
            if (errCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
              failPolling('Lost connection to server. Check My Videos for updates.');
              return;
            }
          }
          schedulePoll();
        }, interval);
      };

      // First poll at 10s (submit-worker hasn't run yet at 3s)
      pollRef.current = setTimeout(() => {
        (async () => {
          try {
            const result = await api.getJobStatus(jobId);
            errCountRef.current = 0;
            if (handlePollResult(result, cleanup, setState)) return;
          } catch (err) {
            errCountRef.current++;
            console.warn(`[useVideoJob] poll error (${errCountRef.current}/${MAX_CONSECUTIVE_ERRORS}):`, err);
            if (errCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
              failPolling('Lost connection to server. Check My Videos for updates.');
              return;
            }
          }
          schedulePoll();
        })();
      }, 10_000);
    },
    [cleanup]
  );

  /** Submit a video generation request */
  const submit = useCallback(
    async (input: GenerateVideoAPIRequest) => {
      cleanup();
      setState({
        ...INITIAL_STATE,
        phase: 'submitting',
      });

      try {
        const { jobId } = await api.generateVideo(input);
        startPolling(jobId);
      } catch (err) {
        setState({
          ...INITIAL_STATE,
          phase: 'failed',
          error: err instanceof Error ? err.message : 'Submission failed',
        });
      }
    },
    [cleanup, startPolling]
  );

  /** Approve a preview and trigger full render */
  const approve = useCallback(async () => {
    if (!state.jobId) return;
    const jobId = state.jobId;

    cleanup();
    setState((s) => ({
      ...s,
      phase: 'approving',
      previewUrl: null,
    }));

    try {
      await api.renderVideo(jobId);
      startPolling(jobId);
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: 'failed',
        error: err instanceof Error ? err.message : 'Render request failed',
      }));
    }
  }, [state.jobId, cleanup, startPolling]);

  /** Reject preview — update DB and return to idle (form state preserved by caller) */
  const reject = useCallback(async () => {
    if (state.jobId) {
      try {
        await api.rejectPreview(state.jobId);
      } catch (err) {
        console.warn('[useVideoJob] reject error:', err);
      }
    }
    cleanup();
    setState(INITIAL_STATE);
  }, [state.jobId, cleanup]);

  /** Resume a preview_ready job (e.g. navigating from My Videos) */
  const resumePreview = useCallback((jobId: string, previewUrl: string) => {
    cleanup();
    setState({
      ...INITIAL_STATE,
      phase: 'preview_ready',
      jobId,
      previewUrl,
      providerStatus: 'preview_ready',
    });
  }, [cleanup]);

  /** Reset to idle */
  const reset = useCallback(() => {
    cleanup();
    setState(INITIAL_STATE);
  }, [cleanup]);

  /** Simulate the full submit → poll → complete flow without calling the API */
  const mockComplete = useCallback((videoUrl: string) => {
    cleanup();
    startRef.current = Date.now();

    setState({ ...INITIAL_STATE, phase: 'submitting' });

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      setState((s) => ({ ...s, elapsedSeconds: elapsed }));
    }, 1000);

    pollRef.current = setTimeout(() => {
      setState((s) => ({
        ...s,
        phase: 'polling',
        jobId: 'test-mode',
        providerStatus: 'rendering',
      }));

      pollRef.current = setTimeout(() => {
        cleanup();
        setState((s) => ({
          ...s,
          phase: 'completed',
          providerStatus: 'completed',
          videoUrl,
        }));
      }, 2000);
    }, 1000);
  }, [cleanup]);

  return { ...state, submit, reset, mockComplete, approve, reject, resumePreview };
}
