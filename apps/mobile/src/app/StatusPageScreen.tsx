/**
 * Purpose: Status-page viewer — overall banner + per-component status + 90d uptime.
 * Inputs: route params { slug }; useApp().api.getStatusPage.
 * Outputs: read-only status page rendering (same data the public page shows).
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
  partial_outage: 'Partial outage',
  major_outage: 'Major outage',
  maintenance: 'Under maintenance',
};

export function StatusPageScreen({ route }: Props) {
  const { slug } = route.params;
  const { api } = useApp();
  const { data: page, loading, error, refresh } = useFetch(() => api.getStatusPage(slug), [api, slug]);

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

          {page.uptime90d !== null && (
            <Text style={styles.uptime}>
              {(page.uptime90d * 100).toFixed(2)}% uptime over the last 90 days
            </Text>
          )}

          {page.components.map((component) => (
            <View key={component.id} style={styles.componentRow}>
              <Text style={styles.componentName}>{component.name}</Text>
              <View style={styles.componentStatusWrap}>
                <View
                  style={[styles.dot, { backgroundColor: componentStatusColor(component.status) }]}
                />
                <Text style={styles.componentStatus}>{component.status.replace('_', ' ')}</Text>
              </View>
            </View>
          ))}
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
  uptime: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  componentName: { color: colors.text },
  componentStatusWrap: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  componentStatus: { color: colors.textMuted, fontSize: 12 },
  error: { color: colors.down, textAlign: 'center', padding: spacing.md },
});
