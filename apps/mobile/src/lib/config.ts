/**
 * Purpose: API endpoint configuration — the self-host-parity switcher.
 *          Persists which backend the app talks to: hosted SaaS
 *          (api.sentry.nself.org), a custom self-hosted URL, or offline demo.
 * Inputs: SecureStore persistence; EXPO_PUBLIC_DEFAULT_API_URL build default.
 * Outputs: getEndpointConfig / setEndpointConfig / resolveBaseUrl.
 * Constraints: URLs normalized (no trailing slash); demo mode needs no URL.
 */
import * as SecureStore from 'expo-secure-store';
import { NSENTRY_SAAS_API_URL } from '@nself/nsentry-client';

const ENDPOINT_MODE_KEY = 'nsentry_endpoint_mode';
const ENDPOINT_URL_KEY = 'nsentry_endpoint_url';

export type EndpointMode = 'saas' | 'custom' | 'demo';

export interface EndpointConfig {
  mode: EndpointMode;
  /** Base URL for mode 'custom'. Ignored for 'saas' (fixed) and 'demo' (mock). */
  customUrl: string | null;
}

/** Normalize a user-entered URL: trim + strip trailing slash. */
export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export async function getEndpointConfig(): Promise<EndpointConfig> {
  const mode = (await SecureStore.getItemAsync(ENDPOINT_MODE_KEY)) as EndpointMode | null;
  const customUrl = await SecureStore.getItemAsync(ENDPOINT_URL_KEY);
  return { mode: mode ?? 'saas', customUrl };
}

export async function setEndpointConfig(config: EndpointConfig): Promise<void> {
  await SecureStore.setItemAsync(ENDPOINT_MODE_KEY, config.mode);
  if (config.customUrl) {
    await SecureStore.setItemAsync(ENDPOINT_URL_KEY, normalizeUrl(config.customUrl));
  } else {
    await SecureStore.deleteItemAsync(ENDPOINT_URL_KEY);
  }
}

/** Resolve the effective API base URL for a config (null for demo mode — mock). */
export function resolveBaseUrl(config: EndpointConfig): string | null {
  switch (config.mode) {
    case 'saas':
      return process.env.EXPO_PUBLIC_DEFAULT_API_URL ?? NSENTRY_SAAS_API_URL;
    case 'custom':
      return config.customUrl ? normalizeUrl(config.customUrl) : null;
    case 'demo':
      return null;
  }
}
