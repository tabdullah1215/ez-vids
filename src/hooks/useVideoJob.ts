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

const POLL_INTERVAL_MS = 5_000;

export function useVideoJob() {
  const [state, setState] = useState<JobState>({
    phase: 'idle',
    jobId: null,
    providerStatus: null,
    videoUrl: null,
    error: null,
    elapsedSeconds: 0,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
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

      // Poll function
      const poll = async () => {
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
          } else if (result.status === 'failed') {
            cleanup();
            setState((s) => ({
              ...s,
              phase: 'failed',
              error: result.errorMessage || 'Video generation failed',
            }));
          }
        } catch (err) {
          // Transient errors — keep polling, don't crash
          console.warn('[useVideoJob] poll error:', err);
        }
      };

      // First check after 3s, then every 5s
      setTimeout(poll, 3000);
      pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
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
