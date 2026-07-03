/**
 * Purpose: Register the device push token with the backend so down alerts /
 *          incident opens can page this device.
 * Inputs: { api, enabled } — the active NsentryClient; only runs when
 *   authenticated against a real backend (not demo).
 * Outputs: PushState — 'registered' | 'coming_soon' | 'permission_denied' |
 *   'unavailable' | 'idle'; side effect POST /v1/push/register (re-registers
 *   on Expo token rotation).
 * Constraints: Permission + token acquisition go through @nself/push-client
 *   (createPushClient('native') + ExpoNotificationsProvider — the shared
 *   nSelf push seam). Registration is REST via NsentryClient because the
 *   gateway contract is /v1/push/register, NOT push-client's Hasura GraphQL
 *   registerWithBackend (which targets np_device_tokens directly). Push
 *   failures never crash the app.
 *
 * TODO(nsentry-push-backend): POST /v1/push/register is NOT live on the SaaS
 * gateway yet — tracked for G-GATEWAY (nself-saas-gateway must accept
 * {token, platform} and hand tokens to nself-alert-router). Until it lands,
 * the live 404 is surfaced as 'coming_soon' (Settings shows "Push alerts
 * coming soon"), never faked as working.
 */
import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { createPushClient, type PushClient } from '@nself/push-client';
import { ExpoNotificationsProvider } from '@nself/native-bridge';
import { isComingOnline, type NsentryClient } from '@nself/nsentry-client';

export type PushState = 'idle' | 'registered' | 'coming_soon' | 'permission_denied' | 'unavailable';

export interface PushTokenOptions {
  /** Authenticated client for the active endpoint — null disables (demo / signed out). */
  api: NsentryClient | null;
  enabled: boolean;
}

/** Registration goes over the gateway REST contract, so push-client's GraphQL
 *  executor must never run — fail loud if anything calls it. */
const restOnlyGql = {
  mutation: async <Data,>() => ({
    data: null as Data | null,
    error: { message: 'nsentry registers push tokens via REST /v1/push/register, not GraphQL' },
  }),
};

function makePushClient(): PushClient {
  return createPushClient('native', {
    gqlClient: restOnlyGql,
    pushTokenProvider: new ExpoNotificationsProvider(),
  });
}

export function usePushToken({ api, enabled }: PushTokenOptions): PushState {
  const [state, setState] = useState<PushState>('idle');

  const registerToken = useCallback(async () => {
    if (!api || !enabled) {
      setState('idle');
      return;
    }
    try {
      // Never re-prompt a user who already denied — check current status first.
      const current = await Notifications.getPermissionsAsync();
      if (current.status === 'denied' && !current.canAskAgain) {
        setState('permission_denied');
        return;
      }

      const push = makePushClient();
      const tokenResult = await push.getToken(); // prompts once if undetermined
      if (tokenResult._tag === 'Err') {
        setState(tokenResult.error.code === 'forbidden' ? 'permission_denied' : 'unavailable');
        return;
      }

      await api.registerPushToken({ token: tokenResult.value, platform: 'expo' });
      setState('registered');
    } catch (e) {
      if (isComingOnline(e)) {
        setState('coming_soon'); // gateway route pending (G-GATEWAY) — graceful
        return;
      }
      // Push registration failure must never crash the app.
      if (__DEV__) console.warn('[usePushToken] Error:', e);
      setState('unavailable');
    }
  }, [api, enabled]);

  useEffect(() => {
    void registerToken();
    const sub = Notifications.addPushTokenListener(() => void registerToken());
    return () => sub.remove();
  }, [registerToken]);

  return state;
}
