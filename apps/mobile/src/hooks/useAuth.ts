/**
 * Purpose: Auth state management — endpoint config, access token, sign-in/out.
 * Inputs: endpoint config (SaaS/custom/demo) + email/password from LoginScreen.
 * Outputs: { endpoint, accessToken, isDemo, loading, error, signIn, enterDemo, signOut }.
 * Constraints: Uses @nself/auth-core NativeAuthStrategy (SecureStore + JWT
 *   refresh loop) against `<baseUrl>/v1/auth` — same shared-nself-auth pattern
 *   as ntask mobile. Demo mode bypasses auth entirely (mock client, no server).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  createNativeAuthStrategy,
  type AuthState as CoreAuthState,
  type AuthStrategy,
  type SecureStoreInterface,
} from '@nself/auth-core';
import {
  getEndpointConfig,
  resolveBaseUrl,
  setEndpointConfig,
  type EndpointConfig,
} from '../lib/config';
import { resetDemoSession } from '../lib/api';

/** SecureStore adapter satisfying @nself/auth-core SecureStoreInterface. */
const secureStoreAdapter: SecureStoreInterface = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  delete: (key: string) => SecureStore.deleteItemAsync(key),
};

export interface UseAuthResult {
  endpoint: EndpointConfig | null;
  accessToken: string | null;
  isDemo: boolean;
  loading: boolean;
  error: string | null;
  signIn: (config: EndpointConfig, email: string, password: string) => Promise<void>;
  enterDemo: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [endpoint, setEndpoint] = useState<EndpointConfig | null>(null);
  const [coreState, setCoreState] = useState<CoreAuthState>({ status: 'loading' });
  const [isDemo, setIsDemo] = useState(false);
  const strategyRef = useRef<AuthStrategy | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const accessToken = coreState.status === 'authenticated' ? coreState.jwt : null;
  const loading = coreState.status === 'loading';
  const error = coreState.status === 'error' ? coreState.error.message : null;

  // On mount: load persisted endpoint + init auth-core strategy (non-demo).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = await getEndpointConfig();
      if (cancelled) return;
      setEndpoint(config);

      if (config.mode === 'demo') {
        setIsDemo(true);
        setCoreState({ status: 'unauthenticated' });
        return;
      }

      const baseUrl = resolveBaseUrl(config);
      if (baseUrl) {
        const strategy = createNativeAuthStrategy(secureStoreAdapter, {
          authBaseUrl: `${baseUrl}/v1/auth`,
        });
        strategyRef.current = strategy;
        unsubRef.current = strategy.subscribe((state) => {
          if (!cancelled) setCoreState(state);
        });
        const initialState = await strategy.init();
        if (!cancelled) setCoreState(initialState);
      } else {
        setCoreState({ status: 'unauthenticated' });
      }
    })();
    return () => {
      cancelled = true;
      unsubRef.current?.();
    };
  }, []);

  const signIn = useCallback(async (config: EndpointConfig, email: string, password: string) => {
    setCoreState({ status: 'loading' });
    setIsDemo(false);
    try {
      await setEndpointConfig(config);
      setEndpoint(config);

      const baseUrl = resolveBaseUrl(config);
      if (!baseUrl) throw new Error('No API endpoint configured');

      unsubRef.current?.();
      const strategy = createNativeAuthStrategy(secureStoreAdapter, {
        authBaseUrl: `${baseUrl}/v1/auth`,
      });
      strategyRef.current = strategy;
      unsubRef.current = strategy.subscribe(setCoreState);

      const result = await strategy.login(email, password);
      setCoreState(result);
    } catch {
      setCoreState({ status: 'unauthenticated' });
    }
  }, []);

  /** Demo mode — seeded mock data, no server, no credentials. */
  const enterDemo = useCallback(async () => {
    const config: EndpointConfig = { mode: 'demo', customUrl: null };
    await setEndpointConfig(config);
    setEndpoint(config);
    setIsDemo(true);
    setCoreState({ status: 'unauthenticated' });
  }, []);

  const signOut = useCallback(async () => {
    if (isDemo) {
      resetDemoSession();
      const config: EndpointConfig = { mode: 'saas', customUrl: null };
      await setEndpointConfig(config);
      setEndpoint(config);
      setIsDemo(false);
      setCoreState({ status: 'unauthenticated' });
      return;
    }
    const strategy = strategyRef.current;
    if (strategy) {
      const result = await strategy.logout();
      setCoreState(result);
    }
  }, [isDemo]);

  return { endpoint, accessToken, isDemo, loading, error, signIn, enterDemo, signOut };
}
