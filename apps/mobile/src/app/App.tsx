/**
 * Purpose: Root app — auth gate, API client provider, navigation
 *          (bottom tabs: Monitors / Incidents / Status / Settings + stack
 *          for detail screens), push token registration.
 * Inputs: useAuth() session; endpoint config; @nself/nsentry-client.
 * Outputs: NavigationContainer with Login | Main(tabs) | MonitorDetail | StatusPage.
 * Constraints:
 *   - Demo mode (mock client) is a first-class path — no server required.
 *   - @nself/ui is web-only (Radix/shadcn) — native UI stays RN components,
 *     same constraint as ntask mobile.
 *   - i18n + observability wiring deferred (TODO below) — not faked.
 *
 * TODO(nsentry-i18n-observability): wire @nself/i18n (RTL init) and
 * @nself/observability (Sentry RN + OTel) the way ntask apps/mobile does once
 * screens stabilize. Deliberately omitted from the scaffold rather than stubbed.
 */
import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import { usePushToken } from '../hooks/usePushToken';
import { createApiClient } from '../lib/api';
import { resolveBaseUrl } from '../lib/config';
import { AppContext } from '../lib/app-context';
import { LoginScreen } from './LoginScreen';
import { MonitorsScreen } from './MonitorsScreen';
import { MonitorDetailScreen } from './MonitorDetailScreen';
import { IncidentsScreen } from './IncidentsScreen';
import { StatusPagesScreen } from './StatusPagesScreen';
import { StatusPageScreen } from './StatusPageScreen';
import { SettingsScreen } from './SettingsScreen';
import { colors } from '../theme';
import type { RootStackParamList, TabParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, string> = {
  Monitors: '◉',
  Incidents: '⚠',
  Status: '▦',
  Settings: '⚙',
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 18 }}>{TAB_ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tabs.Screen name="Monitors" component={MonitorsScreen} />
      <Tabs.Screen name="Incidents" component={IncidentsScreen} />
      <Tabs.Screen name="Status" component={StatusPagesScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export default function App() {
  const auth = useAuth();

  const signedIn = auth.isDemo || auth.accessToken !== null;
  const serverUrl = auth.endpoint ? resolveBaseUrl(auth.endpoint) : null;

  const api = useMemo(
    () =>
      auth.endpoint
        ? createApiClient(auth.endpoint, auth.accessToken)
        : createApiClient({ mode: 'saas', customUrl: null }, null),
    [auth.endpoint, auth.accessToken],
  );

  // Push alerts — no-op in demo mode / before auth (see hook TODO for backend status).
  usePushToken({ serverUrl: auth.isDemo ? null : serverUrl, accessToken: auth.accessToken });

  if (auth.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppContext.Provider value={{ api, auth }}>
        <StatusBar style="light" />
        <NavigationContainer theme={DarkTheme}>
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          >
            {!signedIn ? (
              <Stack.Screen name="Login" options={{ headerShown: false }}>
                {() => <LoginScreen auth={auth} />}
              </Stack.Screen>
            ) : (
              <>
                <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
                <Stack.Screen
                  name="MonitorDetail"
                  component={MonitorDetailScreen}
                  options={({ route }) => ({ title: route.params.name })}
                />
                <Stack.Screen
                  name="StatusPage"
                  component={StatusPageScreen}
                  options={({ route }) => ({ title: route.params.name })}
                />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </AppContext.Provider>
    </SafeAreaProvider>
  );
}
