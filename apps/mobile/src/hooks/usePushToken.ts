/**
 * Purpose: Register the Expo push token with the backend so nself-alert-router
 *          can page this device when monitors go down / incidents open.
 * Inputs: { serverUrl, accessToken } — only registers when authenticated.
 * Outputs: side effect — POST /v1/push/register; re-registers on token refresh.
 * Constraints: Graceful no-op if permissions denied, demo mode, or no EAS
 *   projectId. Push failures never crash the app.
 *
 * TODO(nsentry-push-backend): the alert-router push-register endpoint
 * (POST /v1/push/register → np_device_tokens) is not yet exposed by
 * nself-alert-router (W1 tenantization work). This hook posts the token and
 * tolerates a 404 until the backend lands — the wiring is real, the backend
 * route is pending. Tracked in nself/.claude/docs/nsentry-saas-plan.md W1/W7.
 */
import { useCallback, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export interface PushTokenOptions {
  serverUrl: string | null;
  accessToken: string | null;
}

export function usePushToken({ serverUrl, accessToken }: PushTokenOptions): void {
  const registerToken = useCallback(async () => {
    if (!serverUrl || !accessToken) return;

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      if (!projectId) {
        if (__DEV__) console.warn('[usePushToken] No EAS projectId in app.json extra.eas.projectId');
        return;
      }

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return; // Don't request — only register if already granted

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      const res = await fetch(`${serverUrl}/v1/push/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token, platform: 'expo' }),
      });

      if (!res.ok && __DEV__) {
        console.warn('[usePushToken] Token registration failed:', res.status);
      }
    } catch (err) {
      // Graceful fallback — push registration failure must not crash the app
      if (__DEV__) console.warn('[usePushToken] Error:', err);
    }
  }, [serverUrl, accessToken]);

  useEffect(() => {
    void registerToken();
    const sub = Notifications.addPushTokenListener(() => void registerToken());
    return () => sub.remove();
  }, [registerToken]);
}
