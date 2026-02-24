import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';
import type { GenerateVideoAPIRequest } from '../types/api';

export type JobPhase =
  | 'idle'
  | 'submitting'
  | 'polling'
  | 'completed'
  | 'failed';

interface JobState {
  phase: JobPhase;
  jobId: string | null;
  providerStatus: string | null;
  videoUrl: string | null;
  error: string | null;
  elapsedSeconds: number;
}

/** Adaptive backoff: 15s for first 3 min, 30s for 3-10 min, 60s after 10 min */
function getInterval(elapsedMs: number): number {
  if (elapsedMs < 3 * 60_000) return 15_000;
  if (elapsedMs < 10 * 60_000) return 30_000;
  return 60_000;
}

export function useVideoJob() {
  const [state, setState] = useState<JobState>({
    phase: 'idle',
    jobId: null,
    providerStatus: null,
    videoUrl: null,
    error: null,
    elapsedSeconds: 0,
  });

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);

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

      setState({
        phase: 'polling',
        jobId,
        providerStatus: 'queued',
        videoUrl: null,
        error: null,
        elapsedSeconds: 0,
      });

      // Elapsed timer (every 1s)
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
        setState((s) => ({ ...s, elapsedSeconds: elapsed }));
      }, 1000);

      // Recursive poll with adaptive backoff
      const schedulePoll = () => {
        const elapsedMs = Date.now() - startRef.current;
        const interval = getInterval(elapsedMs);

        pollRef.current = setTimeout(async () => {
          try {
            const result = await api.getJobStatus(jobId);

            setState((s) => ({
              ...s,
              providerStatus: result.status,
              videoUrl: result.videoUrl || null,
              error: result.errorMessage || null,
            }));

            if (result.status === 'completed') {
              cleanup();
              setState((s) => ({ ...s, phase: 'completed' }));
              return;
            } else if (result.status === 'failed') {
              cleanup();
              setState((s) => ({
                ...s,
                phase: 'failed',
                error: result.errorMessage || 'Video generation failed',
              }));
              return;
            }
          } catch (err) {
            // Transient errors — keep polling, don't crash
            console.warn('[useVideoJob] poll error:', err);
          }

          // Schedule next poll with recalculated interval
          schedulePoll();
        }, interval);
      };

      // First poll at 10s (submit-worker hasn't run yet at 3s)
      pollRef.current = setTimeout(() => {
        (async () => {
          try {
            const result = await api.getJobStatus(jobId);

            setState((s) => ({
              ...s,
              providerStatus: result.status,
              videoUrl: result.videoUrl || null,
              error: result.errorMessage || null,
            }));

            if (result.status === 'completed') {
              cleanup();
              setState((s) => ({ ...s, phase: 'completed' }));
              return;
            } else if (result.status === 'failed') {
              cleanup();
              setState((s) => ({
                ...s,
                phase: 'failed',
                error: result.errorMessage || 'Video generation failed',
              }));
              return;
            }
          } catch (err) {
            console.warn('[useVideoJob] poll error:', err);
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
        phase: 'submitting',
        jobId: null,
        providerStatus: null,
        videoUrl: null,
        error: null,
        elapsedSeconds: 0,
      });

      try {
        const { jobId } = await api.generateVideo(input);
        startPolling(jobId);
      } catch (err) {
        setState({
          phase: 'failed',
          jobId: null,
          providerStatus: null,
          videoUrl: null,
          error: err instanceof Error ? err.message : 'Submission failed',
          elapsedSeconds: 0,
        });
      }
    },
    [cleanup, startPolling]
  );

  /** Reset to idle */
  const reset = useCallback(() => {
    cleanup();
    setState({
      phase: 'idle',
      jobId: null,
      providerStatus: null,
      videoUrl: null,
      error: null,
      elapsedSeconds: 0,
    });
  }, [cleanup]);

  return { ...state, submit, reset };
}
