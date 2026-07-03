/**
 * Purpose: Auth state management — endpoint config, credential, sign-in/out.
 * Inputs: endpoint config (SaaS/custom/demo) + email/password OR an nsk_* API
 *   key from LoginScreen.
 * Outputs: { endpoint, accessToken, isDemo, loading, error, signIn,
 *   signInWithApiKey, enterDemo, signOut }.
 * Constraints: The gateway is the auth authority — POST /v1/login
 *   (email/password → 7-day HS256 session JWT) or a long-lived nsk_* API key;
 *   both ride `Authorization: Bearer`. Same contract on the SaaS and any
 *   self-hosted Sentry Bundle deploy (self-host parity). Credentials persist
 *   in expo-secure-store (Keychain/Keystore) with the session expiry; expired
 *   sessions are dropped on launch, never silently reused. Demo mode bypasses
 *   auth entirely (mock client, no server).
 */
import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { NsentryClient } from '@nself/nsentry-client';
import {
  getEndpointConfig,
  resolveBaseUrl,
  setEndpointConfig,
  type EndpointConfig,
} from '../lib/config';
import { resetDemoSession } from '../lib/api';

const TOKEN_KEY = 'nsentry_session_token';
const TOKEN_EXP_KEY = 'nsentry_session_exp';
/** '1' when the stored token is a long-lived nsk_* API key (no expiry). */
const TOKEN_IS_API_KEY = 'nsentry_token_is_api_key';

async function storeCredential(token: string, expiresAtMs: number | null): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (expiresAtMs === null) {
    await SecureStore.setItemAsync(TOKEN_IS_API_KEY, '1');
    await SecureStore.deleteItemAsync(TOKEN_EXP_KEY);
  } else {
    await SecureStore.setItemAsync(TOKEN_EXP_KEY, String(expiresAtMs));
    await SecureStore.deleteItemAsync(TOKEN_IS_API_KEY);
  }
}

async function clearCredential(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(TOKEN_EXP_KEY);
  await SecureStore.deleteItemAsync(TOKEN_IS_API_KEY);
}

/** Restore a stored credential, dropping expired session JWTs. */
async function restoreCredential(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null;
  const isApiKey = (await SecureStore.getItemAsync(TOKEN_IS_API_KEY)) === '1';
  if (isApiKey) return token;
  const exp = Number(await SecureStore.getItemAsync(TOKEN_EXP_KEY));
  if (!Number.isFinite(exp) || Date.now() >= exp) {
    await clearCredential();
    return null;
  }
  return token;
}

export interface UseAuthResult {
  endpoint: EndpointConfig | null;
  accessToken: string | null;
  isDemo: boolean;
  loading: boolean;
  error: string | null;
  /** Email/password → gateway session JWT (POST /v1/login). */
  signIn: (config: EndpointConfig, email: string, password: string) => Promise<void>;
  /** Long-lived nsk_* API key (validated with GET /v1/me before storing). */
  signInWithApiKey: (config: EndpointConfig, apiKey: string) => Promise<void>;
  enterDemo: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [endpoint, setEndpoint] = useState<EndpointConfig | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On mount: load persisted endpoint + restore a non-expired credential.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getEndpointConfig();
        if (cancelled) return;
        setEndpoint(config);
        if (config.mode === 'demo') {
          setIsDemo(true);
          return;
        }
        const token = await restoreCredential();
        if (!cancelled) setAccessToken(token);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (config: EndpointConfig, email: string, password: string) => {
    setLoading(true);
    setError(null);
    setIsDemo(false);
    try {
      await setEndpointConfig(config);
      setEndpoint(config);

      const baseUrl = resolveBaseUrl(config);
      if (!baseUrl) throw new Error('No API endpoint configured');

      const session = await new NsentryClient({ baseUrl }).login(email, password);
      await storeCredential(session.token, Date.now() + session.expiresIn * 1000);
      setAccessToken(session.token);
    } catch (e) {
      setAccessToken(null);
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithApiKey = useCallback(async (config: EndpointConfig, apiKey: string) => {
    setLoading(true);
    setError(null);
    setIsDemo(false);
    try {
      await setEndpointConfig(config);
      setEndpoint(config);

      const baseUrl = resolveBaseUrl(config);
      if (!baseUrl) throw new Error('No API endpoint configured');

      // Validate the key before storing it — surfaces bad keys immediately.
      await new NsentryClient({ baseUrl, apiKey }).me();
      await storeCredential(apiKey, null);
      setAccessToken(apiKey);
    } catch (e) {
      setAccessToken(null);
      setError(e instanceof Error ? e.message : 'API key sign-in failed');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Demo mode — seeded mock data, no server, no credentials. */
  const enterDemo = useCallback(async () => {
    const config: EndpointConfig = { mode: 'demo', customUrl: null };
    await setEndpointConfig(config);
    setEndpoint(config);
    setIsDemo(true);
    setAccessToken(null);
    setError(null);
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    if (isDemo) {
      resetDemoSession();
      const config: EndpointConfig = { mode: 'saas', customUrl: null };
      await setEndpointConfig(config);
      setEndpoint(config);
      setIsDemo(false);
      return;
    }
    await clearCredential();
    setAccessToken(null);
  }, [isDemo]);

  return {
    endpoint,
    accessToken,
    isDemo,
    loading,
    error,
    signIn,
    signInWithApiKey,
    enterDemo,
    signOut,
  };
}
