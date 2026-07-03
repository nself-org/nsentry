/**
 * Purpose: Incidents feed — open/ack/resolved incidents with severity badges;
 *          acknowledge + resolve actions inline.
 * Inputs: useApp().api.listIncidents / acknowledgeIncident / resolveIncident.
 * Outputs: FlatList of incidents with lifecycle actions.
 * Constraints: actions refresh the list; resolved incidents are read-only.
 */
import { useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Incident } from '@nself/nsentry-client';
import { useApp } from '../lib/app-context';
import { useFetch } from '../hooks/useFetch';
import { colors, severityColor, spacing } from '../theme';

function IncidentCard({
  incident,
  onAcknowledge,
  onResolve,
  busy,
}: {
  incident: Incident;
  onAcknowledge: () => void;
  onResolve: () => void;
  busy: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: severityColor(incident.severity) }]}>
          <Text style={styles.badgeText}>{incident.severity}</Text>
        </View>
        <Text style={styles.cardStatus}>{incident.status}</Text>
      </View>
      <Text style={styles.cardTitle}>{incident.title}</Text>
      <Text style={styles.cardTime}>Started {new Date(incident.startedAt).toLocaleString()}</Text>
      {incident.resolvedAt ? (
        <Text style={styles.cardTime}>Resolved {new Date(incident.resolvedAt).toLocaleString()}</Text>
      ) : null}
      {incident.status !== 'resolved' && (
        <View style={styles.actions}>
          {incident.status === 'open' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onAcknowledge}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>Acknowledge</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.resolveButton]}
            onPress={onResolve}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>Resolve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export function IncidentsScreen() {
  const { api } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, loading, error, refresh } = useFetch(() => api.listIncidents(), [api]);

  const act = async (id: string, action: 'ack' | 'resolve') => {
    setBusyId(id);
    try {
      if (action === 'ack') await api.acknowledgeIncident(id);
      else await api.resolveIncident(id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={data ?? []}
        keyExtractor={(i) => i.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.text} />
        }
        renderItem={({ item }) => (
          <IncidentCard
            incident={item}
            busy={busyId === item.id}
            onAcknowledge={() => void act(item.id, 'ack')}
            onResolve={() => void act(item.id, 'resolve')}
          />
        )}
        ListEmptyComponent={
          !loading && !error ? <Text style={styles.empty}>No incidents. Quiet is good.</Text> : null
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  badge: {
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.sm,
  },
  badgeText: { color: colors.bg, fontSize: 11, fontWeight: '700' },
  cardStatus: { color: colors.textMuted, fontSize: 12, textTransform: 'uppercase' },
  cardTitle: { color: colors.text, fontWeight: '600', fontSize: 15 },
  cardUpdate: { color: colors.textMuted, marginTop: spacing.xs, fontSize: 13 },
  cardTime: { color: colors.textMuted, fontSize: 11, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  resolveButton: { borderColor: colors.up },
  actionText: { color: colors.text, fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  error: { color: colors.down, textAlign: 'center', padding: spacing.md },
});
