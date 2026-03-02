import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { AppHeader } from '@/src/components/AppHeader';
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
const POLL_MS = 15_000;

type OrientationFilter = 'all' | '9:16' | '16:9';

function formatElapsed(isoString: string, now: number): string {
  const diffSec = Math.floor((now - new Date(isoString).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ${diffSec % 60}s ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
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
  const orientation = job.request?.aspectRatio === '16:9' ? 'Landscape' : 'Portrait';

  // Active jobs: show time since creation (processing duration)
  // Finished jobs: show time since completion/update (how long ago it finished)
  const referenceTime = isActive
    ? job.createdAt
    : (job.completedAt ?? job.updatedAt);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <StatusIcon status={job.status} />
        <View style={styles.cardMeta}>
          <Text style={styles.statusText}>{job.status}</Text>
          <Text style={styles.elapsed}>{formatElapsed(referenceTime, now)}</Text>
        </View>
        <Text style={styles.orientationBadge}>{orientation}</Text>
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
  const [orientationFilter, setOrientationFilter] = useState<OrientationFilter>('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filteredJobs = useMemo(() => {
    if (orientationFilter === 'all') return jobs;
    return jobs.filter((j) => {
      const ratio = j.request?.aspectRatio ?? '9:16';
      return ratio === orientationFilter;
    });
  }, [jobs, orientationFilter]);

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

  // Clock tick: 1s when active jobs (live timer), 30s when idle (keep "ago" fresh)
  useEffect(() => {
    const hasActive = jobs.some((j) => ACTIVE_STATUSES.has(j.status));
    const interval = hasActive ? 1000 : 30_000;
    clockRef.current = setInterval(() => setNow(Date.now()), interval);
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
      <AppHeader subtitle="MY VIDEOS" />

      {/* Orientation filter (segment toggle) */}
      <View style={styles.segmentRow}>
        {(['all', '9:16', '16:9'] as OrientationFilter[]).map((f) => {
          const active = orientationFilter === f;
          const label = f === 'all' ? 'All' : f === '9:16' ? 'Portrait' : 'Landscape';
          return (
            <TouchableOpacity
              key={f}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => setOrientationFilter(f)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchJobs()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredJobs}
        keyExtractor={(j) => j.jobId}
        extraData={now}
        renderItem={({ item }) => <JobCard job={item} now={now} />}
        contentContainerStyle={filteredJobs.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {orientationFilter === 'all'
              ? 'No videos yet.\nGo to Generate to create one.'
              : `No ${orientationFilter === '9:16' ? 'portrait' : 'landscape'} videos yet.`}
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
    paddingTop: 56,
  },
  center: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Segment toggle (orientation filter) ───
  segmentRow: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: 16, marginBottom: 12,
    backgroundColor: CARD, borderRadius: 10, padding: 3,
    borderWidth: 1, borderColor: BORDER,
  },
  segmentBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: BRAND },
  segmentText: { color: '#aaa', fontSize: 16, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },

  // ─── List ───
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

  // ─── Cards ───
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
  orientationBadge: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
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
