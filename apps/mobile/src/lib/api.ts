/**
 * Purpose: NsentryClient factory for the mobile app — wires the endpoint
 *          switcher (SaaS / custom self-host / demo) + auth token into
 *          @nself/nsentry-client.
 * Inputs: EndpointConfig + accessToken (JWT from nself auth) or demo mode.
 * Outputs: createApiClient(config, accessToken) → NsentryClient.
 * Constraints: Demo mode uses the in-memory mock (createMockFetch) — a single
 *   shared instance per app session so mutations (ack/resolve) persist across screens.
 */
import { NsentryClient } from '@nself/nsentry-client';
import { createMockFetch } from '@nself/nsentry-client/mock';
import { resolveBaseUrl, type EndpointConfig } from './config';

/** One mock per app session so demo-mode mutations persist across screens. */
let sessionMockFetch: ReturnType<typeof createMockFetch> | null = null;

function getSessionMockFetch() {
  if (!sessionMockFetch) sessionMockFetch = createMockFetch();
  return sessionMockFetch;
}

/** Reset the demo session (used on sign-out from demo mode). */
export function resetDemoSession(): void {
  sessionMockFetch = null;
}

/**
 * Build an NsentryClient for the active endpoint config.
 * - demo   → mock transport, no network
 * - saas   → https://api.sentry.nself.org with Bearer JWT
 * - custom → user's self-hosted URL with Bearer JWT
 */
export function createApiClient(config: EndpointConfig, accessToken: string | null): NsentryClient {
  if (config.mode === 'demo') {
    return new NsentryClient({ fetchFn: getSessionMockFetch() });
  }
  const baseUrl = resolveBaseUrl(config);
  return new NsentryClient({
    baseUrl: baseUrl ?? undefined,
    getAccessToken: async () => accessToken,
  });
}
