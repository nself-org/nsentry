/**
 * Purpose: Status-page viewer — overall banner + per-component status +
 *          recent uptime % + active incidents.
 * Inputs: route params { slug }; useApp().api.getPublicStatus (the
 *          unauthenticated /v1/status/public/{slug} route — literally the
 *          same data visitors see).
 * Outputs: read-only status page rendering.
 * Constraints: read-only; public-facing copy (no internal jargon).
 */
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApp } from '../lib/app-context';
import { useFetch } from '../hooks/useFetch';
import { colors, componentStatusColor, spacing } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'StatusPage'>;

const LABEL: Record<string, string> = {
  operational: 'All systems operational',
  degraded: 'Degraded performance',
  down: 'Major outage',
};

export function StatusPageScreen({ route }: Props) {
  const { slug } = route.params;
  const { api } = useApp();
  const { data: page, loading, error, refresh } = useFetch(
    () => api.getPublicStatus(slug),
    [api, slug],
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.text} />
      }
      contentContainerStyle={styles.content}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {page ? (
        <>
          <View
            style={[styles.banner, { backgroundColor: componentStatusColor(page.overallStatus) }]}
          >
            <Text style={styles.bannerText}>
              {LABEL[page.overallStatus] ?? page.overallStatus}
            </Text>
          </View>

          {page.components.map((component) => (
            <View key={component.id} style={styles.componentRow}>
              <Text style={styles.componentName}>{component.name}</Text>
              <View style={styles.componentStatusWrap}>
                <View
                  style={[styles.dot, { backgroundColor: componentStatusColor(component.status) }]}
                />
                <Text style={styles.componentStatus}>
                  {component.uptimePercent !== null
                    ? `${component.uptimePercent.toFixed(2)}% · ${component.status}`
                    : component.status}
                </Text>
              </View>
            </View>
          ))}

          {page.incidents.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Incidents</Text>
              {page.incidents.map((incident, i) => (
                <View key={`${incident.startedAt}_${i}`} style={styles.componentRow}>
                  <Text style={styles.componentName}>{incident.title}</Text>
                  <Text style={styles.componentStatus}>{incident.status}</Text>
                </View>
              ))}
            </>
          ) : null}

          {page.generatedAt ? (
            <Text style={styles.generated}>
              Updated {new Date(page.generatedAt).toLocaleString()}
            </Text>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  banner: { borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
  bannerText: { color: colors.bg, fontWeight: '700', textAlign: 'center' },
  sectionTitle: {
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontSize: 12,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  componentName: { color: colors.text, flexShrink: 1, marginRight: spacing.sm },
  componentStatusWrap: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  componentStatus: { color: colors.textMuted, fontSize: 12 },
  generated: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
  error: { color: colors.down, textAlign: 'center', padding: spacing.md },
});
