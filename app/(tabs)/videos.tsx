import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '@/src/api/client';
import type { JobStatusAPIResponse } from '@/src/types/api';

const BG     = '#0A0A0A';
const CARD   = '#141414';
const BORDER = '#262626';
const BRAND  = '#6366F1';
const TEXT   = '#FFFFFF';
const MUTED  = '#6B7280';
const GREEN  = '#22C55E';
const RED    = '#EF4444';

const ACTIVE_STATUSES = new Set(['pending', 'submitted', 'queued', 'rendering', 'created']);
const POLL_MS = 5_000;

function formatElapsed(isoString: string, now: number): string {
  const diffSec = Math.floor((now - new Date(isoString).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins < 60) return `${mins}m ${secs}s ago`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m ago`;
}

function StatusIcon({ status }: { status: string }) {
  if (ACTIVE_STATUSES.has(status)) {
    return <ActivityIndicator size="small" color={BRAND} />;
  }
  if (status === 'completed') {
    return <Text style={[styles.statusIcon, { color: GREEN }]}>✓</Text>;
  }
  return <Text style={[styles.statusIcon, { color: RED }]}>✗</Text>;
}

function JobCard({ job, now }: { job: JobStatusAPIResponse; now: number }) {
  const scriptPreview = job.request?.scriptText?.slice(0, 60) || '(no script)';
  const isActive = ACTIVE_STATUSES.has(job.status);

  // For finished jobs, freeze the elapsed time at completion; for active jobs, use live clock
  const elapsedEnd = isActive
    ? now
    : new Date(job.completedAt ?? job.updatedAt).getTime();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <StatusIcon status={job.status} />
        <View style={styles.cardMeta}>
          <Text style={styles.statusText}>{job.status}</Text>
          <Text style={styles.elapsed}>{formatElapsed(job.createdAt, elapsedEnd)}</Text>
        </View>
      </View>

      <Text style={styles.script} numberOfLines={2}>{scriptPreview}</Text>

      {isActive && (
        <Text style={styles.hint}>Processing… check back shortly</Text>
      )}

      {job.status === 'completed' && job.videoUrl && (
        <TouchableOpacity
          style={styles.openBtn}
          onPress={() => Linking.openURL(job.videoUrl!)}
          activeOpacity={0.75}
        >
          <Text style={styles.openBtnText}>▶  Open Video</Text>
        </TouchableOpacity>
      )}

      {job.status === 'failed' && job.errorMessage && (
        <Text style={styles.errorText} numberOfLines={2}>{job.errorMessage}</Text>
      )}
    </View>
  );
}

export default function VideosScreen() {
  const [jobs, setJobs]         = useState<JobStatusAPIResponse[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [now, setNow]           = useState(Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setError(null);
    try {
      const { jobs: fetched } = await api.getJobs();
      setJobs(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Start/stop the 5s poll based on whether any jobs are active
  useEffect(() => {
    const hasActive = jobs.some((j) => ACTIVE_STATUSES.has(j.status));
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(() => fetchJobs(true), POLL_MS);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [jobs, fetchJobs]);

  // Clock tick so elapsed times update every second (only while jobs are active)
  useEffect(() => {
    const hasActive = jobs.some((j) => ACTIVE_STATUSES.has(j.status));
    if (hasActive) {
      clockRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else {
      setNow(Date.now());          // one final update so timestamps are fresh
      if (clockRef.current) { clearInterval(clockRef.current); clockRef.current = null; }
    }
    return () => { if (clockRef.current) { clearInterval(clockRef.current); clockRef.current = null; } };
  }, [jobs]);

  // Initial load + re-fetch whenever this tab gains focus
  // (catches jobs submitted while on the Generate tab)
  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, [fetchJobs]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Videos</Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchJobs()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={jobs}
        keyExtractor={(j) => j.jobId}
        extraData={now}
        renderItem={({ item }) => <JobCard job={item} now={now} />}
        contentContainerStyle={jobs.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No videos yet.{'\n'}Go to Generate to create one.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: 60,
  },
  center: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    color: TEXT,
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: MUTED,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardMeta: {
    flex: 1,
  },
  statusIcon: {
    fontSize: 18,
    width: 20,
    textAlign: 'center',
  },
  statusText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  elapsed: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  script: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    color: BRAND,
    fontSize: 12,
  },
  openBtn: {
    backgroundColor: BRAND,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  openBtnText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: RED,
    fontSize: 12,
    lineHeight: 16,
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#1A0A0A',
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorBoxText: {
    color: RED,
    fontSize: 13,
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: RED,
  },
  retryBtnText: {
    color: RED,
    fontSize: 13,
  },
});
