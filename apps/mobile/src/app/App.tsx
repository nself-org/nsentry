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
 *   - Down-alert taps (push or local fallback) + nsentry://monitor/{id} deep
 *     links land on MonitorDetail; taps before sign-in are held and replayed
 *     once authenticated.
 *   - i18n + observability wiring deferred (TODO below) — not faked.
 *
 * TODO(nsentry-i18n-observability): wire @nself/i18n (RTL init) and
 * @nself/observability (Sentry RN + OTel) the way ntask apps/mobile does once
 * screens stabilize. Deliberately omitted from the scaffold rather than stubbed.
 */
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  NavigationContainer,
  DarkTheme,
  createNavigationContainerRef,
  type LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import { usePushToken } from '../hooks/usePushToken';
import { createApiClient } from '../lib/api';
import { AppContext } from '../lib/app-context';
import { LoginScreen } from './LoginScreen';
import { MonitorsScreen } from './MonitorsScreen';
import { MonitorDetailScreen } from './MonitorDetailScreen';
import { IncidentsScreen } from './IncidentsScreen';
import { StatusPagesScreen } from './StatusPagesScreen';
import { StatusPageScreen } from './StatusPageScreen';
import { SettingsScreen } from './SettingsScreen';
import {
  configureNotificationHandling,
  monitorTargetFromResponse,
  type MonitorTarget,
} from '../lib/notifications';
import { colors } from '../theme';
import type { RootStackParamList, TabParamList } from '../types';

// Show down alerts even when the app is foregrounded (module load, once).
configureNotificationHandling();

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** nsentry://monitor/{id} and nsentry://status/{slug} deep links. */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['nsentry://'],
  config: {
    screens: {
      Main: 'home',
      MonitorDetail: 'monitor/:monitorId',
      StatusPage: 'status/:slug',
    },
  },
};

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

  const api = useMemo(
    () =>
      auth.endpoint
        ? createApiClient(auth.endpoint, auth.accessToken)
        : createApiClient({ mode: 'saas', customUrl: null }, null),
    [auth.endpoint, auth.accessToken],
  );

  // Down-alert push registration — no-op in demo mode / before auth.
  // 'coming_soon' until the gateway ships POST /v1/push/register (G-GATEWAY).
  const push = usePushToken({
    api: auth.isDemo || !auth.accessToken ? null : api,
    enabled: signedIn && !auth.isDemo,
  });

  // Down-alert tap → MonitorDetail. Taps that arrive before auth resolves
  // (cold start from a push) are held here and replayed once signed in.
  const pendingTarget = useRef<MonitorTarget | null>(null);

  useEffect(() => {
    const openTarget = (target: MonitorTarget | null) => {
      if (!target) return;
      if (navigationRef.isReady() && (auth.isDemo || auth.accessToken !== null)) {
        navigationRef.navigate('MonitorDetail', {
          monitorId: target.monitorId,
          ...(target.name ? { name: target.name } : {}),
        });
      } else {
        pendingTarget.current = target;
      }
    };

    // Cold start: the tap that launched the app.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openTarget(monitorTargetFromResponse(response));
    });
    // Warm taps while running/backgrounded.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      openTarget(monitorTargetFromResponse(response));
    });
    return () => sub.remove();
  }, [auth.isDemo, auth.accessToken]);

  // Replay a held tap once the user is signed in and navigation is mounted.
  useEffect(() => {
    if (!signedIn || !pendingTarget.current) return;
    const target = pendingTarget.current;
    pendingTarget.current = null;
    // Defer one tick so the signed-in navigator has mounted.
    const t = setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('MonitorDetail', {
          monitorId: target.monitorId,
          ...(target.name ? { name: target.name } : {}),
        });
      }
    }, 0);
    return () => clearTimeout(t);
  }, [signedIn]);

  if (auth.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppContext.Provider value={{ api, auth, push }}>
        <StatusBar style="light" />
        <NavigationContainer ref={navigationRef} theme={DarkTheme} linking={linking}>
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
                  options={({ route }) => ({ title: route.params.name ?? 'Monitor' })}
                />
                <Stack.Screen
                  name="StatusPage"
                  component={StatusPageScreen}
                  options={({ route }) => ({ title: route.params.name ?? 'Status' })}
                />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </AppContext.Provider>
    </SafeAreaProvider>
  );
}
