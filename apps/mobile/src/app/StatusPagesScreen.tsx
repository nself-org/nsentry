/**
 * Purpose: Status pages tab — the tenant's status-page registry; tap → the
 *          public viewer (same data visitors see).
 * Inputs: useApp().api.listStatusPages() (live gateway contract — StatusPage[]).
 * Outputs: FlatList of status pages with visibility badge.
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
import { useApp } from '../lib/app-context';
import { useFetch } from '../hooks/useFetch';
import { colors, spacing } from '../theme';
import type { RootStackParamList } from '../types';

export function StatusPagesScreen() {
  const { api } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, loading, error, refresh } = useFetch(() => api.listStatusPages(), [api]);

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={data ?? []}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.text} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('StatusPage', { slug: item.slug, name: item.name })}
            accessibilityRole="button"
          >
            <View style={[styles.dot, { backgroundColor: item.public ? colors.up : colors.paused }]} />
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.slug}>/s/{item.slug}</Text>
            </View>
            <Text style={styles.status}>{item.public ? 'public' : 'unlisted'}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.empty}>No status pages yet. Create one in the dashboard.</Text>
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
  name: { color: colors.text, fontWeight: '600' },
  slug: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  status: { color: colors.textMuted, fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  error: { color: colors.down, textAlign: 'center', padding: spacing.md },
});
