/**
 * Purpose: Monitor detail — status, interval, pause/resume, recent probe
 *          results.
 * Inputs: route params { monitorId }; useApp().api.
 * Outputs: detail card + checks list; pause/resume mutations.
 * Constraints: mutations refresh the monitor after completing. The checks
 *   route is rolling out on the SaaS gateway — a 404 renders as "check
 *   history is coming online" (isComingOnline), never an error or crash.
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
import { isComingOnline, NsentryApiError, type MonitorCheck } from '@nself/nsentry-client';
import { useApp } from '../lib/app-context';
import { useFetch } from '../hooks/useFetch';
import { colors, monitorStatusColor, spacing } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'MonitorDetail'>;

function CheckRow({ check }: { check: MonitorCheck }) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.dot, { backgroundColor: check.status === 'up' ? colors.up : colors.down }]} />
      <Text style={styles.checkStatus}>{check.status}</Text>
      <Text style={styles.checkMeta}>{check.latencyMs !== null ? `${check.latencyMs} ms` : '—'}</Text>
      <Text style={styles.checkTime}>{new Date(check.checkedAt).toLocaleTimeString()}</Text>
    </View>
  );
}

export function MonitorDetailScreen({ route }: Props) {
  const { monitorId } = route.params;
  const { api } = useApp();
  const [mutating, setMutating] = useState(false);

  const monitorQ = useFetch(() => api.getMonitor(monitorId), [api, monitorId]);
  // Rolling out on the SaaS: swallow "coming online" into an empty-but-flagged state.
  const checksQ = useFetch<{ checks: MonitorCheck[]; comingOnline: boolean }>(async () => {
    try {
      return { checks: await api.listChecks(monitorId, { limit: 25 }), comingOnline: false };
    } catch (e) {
      if (isComingOnline(e)) return { checks: [], comingOnline: true };
      throw e;
    }
  }, [api, monitorId]);

  const monitor = monitorQ.data;

  const togglePause = async () => {
    if (!monitor) return;
    setMutating(true);
    try {
      if (monitor.status === 'paused') await api.resumeMonitor(monitor.id);
      else await api.pauseMonitor(monitor.id);
      await monitorQ.refresh();
    } catch (e) {
      // Mutation failures surface via the next refresh; never crash the screen.
      if (__DEV__ && e instanceof NsentryApiError) console.warn('[MonitorDetail]', e.code);
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
            <Text style={styles.statValue}>{monitor.kind.toUpperCase()}</Text>
            <Text style={styles.statLabel}>probe</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{monitor.intervalSeconds}s</Text>
            <Text style={styles.statLabel}>interval</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{new Date(monitor.createdAt).toLocaleDateString()}</Text>
            <Text style={styles.statLabel}>since</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent checks</Text>
      <FlatList
        data={checksQ.data?.checks ?? []}
        keyExtractor={(c, i) => `${c.checkedAt}_${i}`}
        refreshControl={
          <RefreshControl
            refreshing={checksQ.loading}
            onRefresh={() => void checksQ.refresh()}
            tintColor={colors.text}
          />
        }
        renderItem={({ item }) => <CheckRow check={item} />}
        ListEmptyComponent={
          !checksQ.loading ? (
            <Text style={styles.empty}>
              {checksQ.data?.comingOnline
                ? 'Check history is coming online for this endpoint — the monitor is still probing.'
                : (checksQ.error ?? 'No checks recorded yet.')}
            </Text>
          ) : null
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
  checkStatus: { color: colors.text, width: 60, fontSize: 12, textTransform: 'uppercase' },
  checkMeta: { color: colors.textMuted, flex: 1, fontSize: 12 },
  checkTime: { color: colors.textMuted, fontSize: 11 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  error: { color: colors.down, textAlign: 'center', padding: spacing.md },
});
