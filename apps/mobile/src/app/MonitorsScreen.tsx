/**
 * Purpose: Monitors list — status dot, check interval; pull-to-refresh;
 *          tap → MonitorDetail.
 * Inputs: useApp().api.listMonitors() (live gateway contract — Monitor[]).
 * Outputs: FlatList of monitors; local down-alert fallback on up→down
 *          transitions while server push is pending (useDownAlertFallback).
 * Constraints: handles loading / error / empty states explicitly.
 */
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Monitor } from '@nself/nsentry-client';
import { useApp } from '../lib/app-context';
import { useFetch } from '../hooks/useFetch';
import { useDownAlertFallback } from '../hooks/useDownAlertFallback';
import { colors, monitorStatusColor, spacing } from '../theme';
import type { RootStackParamList } from '../types';

function MonitorRow({ monitor, onPress }: { monitor: Monitor; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={[styles.dot, { backgroundColor: monitorStatusColor(monitor.status) }]} />
      <View style={styles.rowBody}>
        <Text style={styles.name}>{monitor.name}</Text>
        <Text style={styles.url} numberOfLines={1}>
          {monitor.url}
        </Text>
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.metaMain}>{monitor.status.toUpperCase()}</Text>
        <Text style={styles.metaSub}>every {monitor.intervalSeconds}s</Text>
      </View>
    </TouchableOpacity>
  );
}

export function MonitorsScreen() {
  const { api, auth, push } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, loading, error, refresh } = useFetch(() => api.listMonitors(), [api]);

  // Local notification when a refresh reveals up→down and server push isn't live.
  useDownAlertFallback({ monitors: data, pushState: push, enabled: !auth.isDemo });

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={data ?? []}
        keyExtractor={(m) => m.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.text} />
        }
        renderItem={({ item }) => (
          <MonitorRow
            monitor={item}
            onPress={() => navigation.navigate('MonitorDetail', { monitorId: item.id, name: item.name })}
          />
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.empty}>No monitors yet. Create one in the ɳSentry dashboard or CLI.</Text>
          ) : null
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.md },
  rowBody: { flex: 1 },
  name: { color: colors.text, fontWeight: '600', fontSize: 16 },
  url: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rowMeta: { alignItems: 'flex-end' },
  metaMain: { color: colors.text, fontWeight: '600' },
  metaSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  error: { color: colors.down, textAlign: 'center', padding: spacing.md },
});
