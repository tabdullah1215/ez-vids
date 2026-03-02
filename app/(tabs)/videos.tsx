import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '@/src/api/client';
import { AppHeader } from '@/src/components/AppHeader';
import { createThemedStyles, useTheme } from '@/src/theme';
import type { JobStatusAPIResponse } from '@/src/types/api';

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
  const styles = useStyles();
  const { colors } = useTheme();

  if (ACTIVE_STATUSES.has(status)) {
    return <ActivityIndicator size="small" color={colors.brand} />;
  }
  if (status === 'completed') {
    return <Text style={[styles.statusIcon, { color: colors.success }]}>✓</Text>;
  }
  return <Text style={[styles.statusIcon, { color: colors.error }]}>✗</Text>;
}

function JobCard({ job, now }: { job: JobStatusAPIResponse; now: number }) {
  const styles = useStyles();
  const scriptPreview = job.request?.scriptText?.slice(0, 60) || '(no script)';
  const isActive = ACTIVE_STATUSES.has(job.status);
  const orientation = job.request?.aspectRatio === '16:9' ? 'Landscape' : 'Portrait';

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
  const styles = useStyles();
  const { colors } = useTheme();
  const [jobs, setJobs]         = useState<JobStatusAPIResponse[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [now, setNow]           = useState(Date.now());
  const [orientationFilter, setOrientationFilter] = useState<OrientationFilter>('all');
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filteredJobs = useMemo(() => {
    if (orientationFilter === 'all') return jobs;
    return jobs.filter((j) => {
      const ratio = j.request?.aspectRatio ?? '9:16';
      return ratio === orientationFilter;
    });
  }, [jobs, orientationFilter]);

  const stats = useMemo(() => {
    const totalCredits = jobs.reduce((sum, j) => sum + (j.creditsUsed ?? 0), 0);
    const latest = jobs.length > 0
      ? jobs.reduce((newest, j) => {
          const t = j.completedAt ?? j.updatedAt;
          return t > newest ? t : newest;
        }, jobs[0].completedAt ?? jobs[0].updatedAt)
      : null;
    return { count: jobs.length, credits: totalCredits, latest };
  }, [jobs]);

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setError(null);
    try {
      const [{ jobs: fetched }, balance] = await Promise.all([
        api.getJobs(),
        api.getCreditBalance().catch(() => null),
      ]);
      setJobs(fetched);
      if (balance) setRemainingCredits(balance.remainingCredits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  useEffect(() => {
    const hasActive = jobs.some((j) => ACTIVE_STATUSES.has(j.status));
    const interval = hasActive ? 1000 : 30_000;
    clockRef.current = setInterval(() => setNow(Date.now()), interval);
    return () => { if (clockRef.current) { clearInterval(clockRef.current); clockRef.current = null; } };
  }, [jobs]);

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
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader subtitle="MY VIDEOS">
        {jobs.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.count}</Text>
              <Text style={styles.statLabel}>Videos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.credits}</Text>
              <Text style={styles.statLabel}>Used</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {remainingCredits != null ? remainingCredits : '—'}
              </Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats.latest ? formatElapsed(stats.latest, now) : '—'}
              </Text>
              <Text style={styles.statLabel}>Latest</Text>
            </View>
          </View>
        )}
      </AppHeader>

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
            tintColor={colors.brand}
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

const useStyles = createThemedStyles((c) => ({
  container: {
    flex: 1,
    backgroundColor: c.bg,
    paddingTop: 56,
  },
  center: {
    flex: 1,
    backgroundColor: c.bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  // ─── Header stats ───
  statsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 16,
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center' as const,
  },
  statValue: {
    color: c.textPrimary,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  statLabel: {
    color: c.textSubdued,
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: c.border,
  },

  // ─── Segment toggle (orientation filter) ───
  segmentRow: {
    flexDirection: 'row' as const, marginHorizontal: 20, marginTop: 16, marginBottom: 12,
    backgroundColor: c.surface, borderRadius: 10, padding: 3,
    borderWidth: 1, borderColor: c.border,
  },
  segmentBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    alignItems: 'center' as const,
  },
  segmentBtnActive: { backgroundColor: c.brand },
  segmentText: { color: c.textInactive, fontSize: 16, fontWeight: '600' as const },
  segmentTextActive: { color: c.textPrimary },

  // ─── List ───
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyText: {
    color: c.textSubdued,
    fontSize: 15,
    textAlign: 'center' as const,
    lineHeight: 24,
  },

  // ─── Cards ───
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  cardMeta: {
    flex: 1,
  },
  statusIcon: {
    fontSize: 18,
    width: 20,
    textAlign: 'center' as const,
  },
  statusText: {
    color: c.textPrimary,
    fontSize: 14,
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  elapsed: {
    color: c.textSubdued,
    fontSize: 12,
    marginTop: 2,
  },
  orientationBadge: {
    color: c.textSubdued,
    fontSize: 12,
    fontWeight: '600' as const,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden' as const,
  },
  script: {
    color: c.textSubdued,
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    color: c.brand,
    fontSize: 12,
  },
  openBtn: {
    backgroundColor: c.brand,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center' as const,
  },
  openBtnText: {
    color: c.textPrimary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  errorText: {
    color: c.error,
    fontSize: 12,
    lineHeight: 16,
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: c.surfaceErrorTint,
    borderWidth: 1,
    borderColor: c.error,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  errorBoxText: {
    color: c.error,
    fontSize: 13,
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.error,
  },
  retryBtnText: {
    color: c.error,
    fontSize: 13,
  },
}));
