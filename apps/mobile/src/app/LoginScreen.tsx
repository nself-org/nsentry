/**
 * Purpose: Sign-in screen — shared nself auth (email/password) against the
 *          selected endpoint (SaaS or custom self-host), plus Demo mode.
 * Inputs: useAuth().signIn / enterDemo; endpoint mode toggle.
 * Outputs: authenticated session (JWT via @nself/auth-core) or demo session.
 * Constraints: never logs credentials; custom URL normalized in lib/config.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { EndpointMode } from '../lib/config';
import type { UseAuthResult } from '../hooks/useAuth';
import { colors, spacing } from '../theme';

interface Props {
  auth: UseAuthResult;
}

export function LoginScreen({ auth }: Props) {
  const [mode, setMode] = useState<Exclude<EndpointMode, 'demo'>>('saas');
  const [customUrl, setCustomUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    email.length > 0 && password.length > 0 && (mode === 'saas' || customUrl.length > 0);

  const onSignIn = async () => {
    setSubmitting(true);
    try {
      await auth.signIn({ mode, customUrl: mode === 'custom' ? customUrl : null }, email, password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>ɳSentry</Text>
      <Text style={styles.tagline}>Monitors, incidents & status pages</Text>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'saas' && styles.modeButtonActive]}
          onPress={() => setMode('saas')}
          accessibilityRole="button"
        >
          <Text style={styles.modeText}>sentry.nself.org</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'custom' && styles.modeButtonActive]}
          onPress={() => setMode('custom')}
          accessibilityRole="button"
        >
          <Text style={styles.modeText}>Self-hosted</Text>
        </TouchableOpacity>
      </View>

      {mode === 'custom' && (
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
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}

      <TouchableOpacity
        style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit || submitting}
        onPress={onSignIn}
        accessibilityRole="button"
      >
        {submitting ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.primaryButtonText}>Sign in</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => void auth.enterDemo()} accessibilityRole="button">
        <Text style={styles.demoLink}>Try demo mode (no server needed)</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logo: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
  },
  tagline: {
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeButton: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  modeText: { color: colors.text },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  error: {
    color: colors.down,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.text, fontWeight: '600' },
  demoLink: {
    color: colors.primary,
    textAlign: 'center',
    padding: spacing.sm,
  },
});
