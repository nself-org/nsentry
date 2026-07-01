/**
 * Purpose: Monitor detail — uptime stats, pause/resume, recent check results.
 * Inputs: route params { monitorId }; useApp().api.
 * Outputs: detail card + checks list; pause/resume mutations.
 * Constraints: mutations refresh the monitor after completing.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CheckResult } from '@nself/nsentry-client';
import { useApp } from '../lib/app-context';
import { useFetch } from '../hooks/useFetch';
import { colors, monitorStatusColor, spacing } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'MonitorDetail'>;

const pct = (v: number | null): string => (v === null ? '—' : `${(v * 100).toFixed(2)}%`);

function CheckRow({ check }: { check: CheckResult }) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.dot, { backgroundColor: check.ok ? colors.up : colors.down }]} />
      <Text style={styles.checkRegion}>{check.region}</Text>
      <Text style={styles.checkMeta}>
        {check.ok ? `${check.statusCode} · ${check.latencyMs} ms` : (check.error ?? 'failed')}
      </Text>
      <Text style={styles.checkTime}>{new Date(check.checkedAt).toLocaleTimeString()}</Text>
    </View>
  );
}

export function MonitorDetailScreen({ route }: Props) {
  const { monitorId } = route.params;
  const { api } = useApp();
  const [mutating, setMutating] = useState(false);

  const monitorQ = useFetch(() => api.getMonitor(monitorId), [api, monitorId]);
  const checksQ = useFetch(() => api.listChecks(monitorId, { limit: 25 }), [api, monitorId]);

  const monitor = monitorQ.data;

  const togglePause = async () => {
    if (!monitor) return;
    setMutating(true);
    try {
      if (monitor.status === 'paused') await api.resumeMonitor(monitor.id);
      else await api.pauseMonitor(monitor.id);
      await monitorQ.refresh();
    } finally {
      setMutating(false);
    }
  };

  if (monitorQ.loading && !monitor) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (monitorQ.error || !monitor) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.error}>{monitorQ.error ?? 'Monitor not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={[styles.dot, { backgroundColor: monitorStatusColor(monitor.status) }]} />
          <Text style={styles.status}>{monitor.status.toUpperCase()}</Text>
          <TouchableOpacity
            style={styles.pauseButton}
            onPress={() => void togglePause()}
            disabled={mutating}
            accessibilityRole="button"
          >
            <Text style={styles.pauseText}>{monitor.status === 'paused' ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.url}>{monitor.url}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{pct(monitor.uptime24h)}</Text>
            <Text style={styles.statLabel}>24h uptime</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{pct(monitor.uptime30d)}</Text>
            <Text style={styles.statLabel}>30d uptime</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {monitor.latencyP50Ms !== null ? `${monitor.latencyP50Ms} ms` : '—'}
            </Text>
            <Text style={styles.statLabel}>p50 latency</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{monitor.intervalSeconds}s</Text>
            <Text style={styles.statLabel}>interval</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent checks</Text>
      <FlatList
        data={checksQ.data?.items ?? []}
        keyExtractor={(c) => c.id}
        refreshControl={
          <RefreshControl
            refreshing={checksQ.loading}
            onRefresh={() => void checksQ.refresh()}
            tintColor={colors.text}
          />
        }
        renderItem={({ item }) => <CheckRow check={item} />}
        ListEmptyComponent={
          !checksQ.loading ? <Text style={styles.empty}>No checks recorded yet.</Text> : null
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    margin: spacing.md,
    padding: spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.sm },
  status: { color: colors.text, fontWeight: '700', flex: 1 },
  pauseButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  pauseText: { color: colors.text },
  url: { color: colors.textMuted, marginTop: spacing.sm },
  statsRow: { flexDirection: 'row', marginTop: spacing.md },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontWeight: '600' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  sectionTitle: {
    color: colors.textMuted,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  checkRegion: { color: colors.text, width: 90, fontSize: 12 },
  checkMeta: { color: colors.textMuted, flex: 1, fontSize: 12 },
  checkTime: { color: colors.textMuted, fontSize: 11 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  error: { color: colors.down, textAlign: 'center', padding: spacing.md },
});
