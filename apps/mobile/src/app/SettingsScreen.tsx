/**
 * Purpose: Settings — API endpoint switcher (the self-host-parity feature:
 *          SaaS at api.sentry.nself.org OR a custom self-hosted URL), tenant
 *          info, and sign-out.
 * Inputs: useApp() — auth session + api.me(); endpoint config from lib/config.
 * Outputs: persisted endpoint change (signs the session out — tokens are
 *          per-backend), sign-out.
 * Constraints: switching endpoints requires re-auth (JWTs don't cross backends).
 */
import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useApp } from '../lib/app-context';
import { useFetch } from '../hooks/useFetch';
import { normalizeUrl } from '../lib/config';
import { colors, spacing } from '../theme';

export function SettingsScreen() {
  const { api, auth } = useApp();
  const [customUrl, setCustomUrl] = useState(auth.endpoint?.customUrl ?? '');

  const tenantQ = useFetch(() => api.me(), [api]);
  const tenant = tenantQ.data;

  const switchEndpoint = (mode: 'saas' | 'custom') => {
    const url = mode === 'custom' ? normalizeUrl(customUrl) : null;
    if (mode === 'custom' && !url) {
      Alert.alert('Enter your self-hosted ɳSentry URL first.');
      return;
    }
    Alert.alert(
      'Switch API endpoint?',
      'You will be signed out — sessions are per-backend.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await auth.signOut();
              // Persist the new target so LoginScreen preselects it.
              const { setEndpointConfig } = await import('../lib/config');
              await setEndpointConfig({ mode, customUrl: url });
            })();
          },
        },
      ],
    );
  };

  const endpointLabel =
    auth.endpoint?.mode === 'demo'
      ? 'Demo mode (offline mock data)'
      : auth.endpoint?.mode === 'custom'
        ? (auth.endpoint.customUrl ?? 'custom')
        : 'api.sentry.nself.org (SaaS)';

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.card}>
        {tenant ? (
          <>
            <Row label="Tenant" value={tenant.name} />
            <Row label="Tier" value={tenant.tier} />
            <Row
              label="Quota"
              value={`${tenant.quotas.monitors} monitors @ ${tenant.quotas.minIntervalSeconds}s`}
            />
          </>
        ) : (
          <Text style={styles.muted}>{tenantQ.error ?? 'Loading tenant…'}</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>API endpoint</Text>
      <View style={styles.card}>
        <Row label="Current" value={endpointLabel} />
        <Text style={styles.help}>
          ɳSentry works with the hosted SaaS or your own self-hosted nSelf stack running the
          Sentry Bundle — same app, same features.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => switchEndpoint('saas')}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Use sentry.nself.org</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="https://sentry.your-domain.org"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={customUrl}
          onChangeText={setCustomUrl}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={() => switchEndpoint('custom')}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Use custom self-hosted URL</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.signOut]}
        onPress={() => void auth.signOut()}
        accessibilityRole="button"
      >
        <Text style={styles.signOutText}>{auth.isDemo ? 'Exit demo mode' : 'Sign out'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  sectionTitle: {
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontSize: 12,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  rowLabel: { color: colors.textMuted },
  rowValue: { color: colors.text, flexShrink: 1, marginLeft: spacing.md },
  help: { color: colors.textMuted, fontSize: 12, marginVertical: spacing.sm },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: 8,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonText: { color: colors.text },
  signOut: { marginTop: spacing.lg, borderColor: colors.down },
  signOutText: { color: colors.down },
  muted: { color: colors.textMuted },
});
