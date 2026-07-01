/**
 * Purpose: Unit tests for the endpoint switcher (lib/config) — the
 *          self-host-parity feature. Verifies persistence, normalization,
 *          and base-URL resolution for saas/custom/demo modes.
 * Inputs: mocked expo-secure-store (in-memory).
 * Outputs: jest assertions.
 */
import {
  getEndpointConfig,
  normalizeUrl,
  resolveBaseUrl,
  setEndpointConfig,
} from '../lib/config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const secureStore = require('expo-secure-store');

describe('lib/config — endpoint switcher', () => {
  beforeEach(() => secureStore.__reset());

  it('defaults to SaaS mode when nothing is persisted', async () => {
    const config = await getEndpointConfig();
    expect(config.mode).toBe('saas');
    expect(resolveBaseUrl(config)).toBe('https://api.sentry.nself.org');
  });

  it('persists and restores a custom self-hosted endpoint', async () => {
    await setEndpointConfig({ mode: 'custom', customUrl: 'https://sentry.my-org.dev/' });
    const config = await getEndpointConfig();
    expect(config.mode).toBe('custom');
    expect(config.customUrl).toBe('https://sentry.my-org.dev');
    expect(resolveBaseUrl(config)).toBe('https://sentry.my-org.dev');
  });

  it('demo mode resolves to null (mock transport, no network)', async () => {
    await setEndpointConfig({ mode: 'demo', customUrl: null });
    const config = await getEndpointConfig();
    expect(config.mode).toBe('demo');
    expect(resolveBaseUrl(config)).toBeNull();
  });

  it('normalizeUrl strips whitespace and trailing slashes', () => {
    expect(normalizeUrl('  https://a.b/// ')).toBe('https://a.b');
    expect(normalizeUrl('http://192.168.1.10:8080/')).toBe('http://192.168.1.10:8080');
  });

  it('clears a stored custom URL when switching back to SaaS with no URL', async () => {
    await setEndpointConfig({ mode: 'custom', customUrl: 'https://x.y' });
    await setEndpointConfig({ mode: 'saas', customUrl: null });
    const config = await getEndpointConfig();
    expect(config.mode).toBe('saas');
    expect(config.customUrl).toBeNull();
  });
});
