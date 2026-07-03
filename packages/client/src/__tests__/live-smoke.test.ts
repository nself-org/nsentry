/**
 * Live-gateway smoke test — @nself/nsentry-client vs the REAL SaaS API.
 *
 * Purpose: Prove the typed client speaks the live api.sentry.nself.org
 *          contract (enveloped snake_case wire → mapped view models):
 *          signup → login (JWT) → me/overview/monitors CRUD/incidents/
 *          status-pages, plus the push-register "coming online" path.
 * Inputs:  env NSENTRY_LIVE_E2E=1 (opt-in — suite is SKIPPED otherwise so
 *          normal CI stays offline); optional NSENTRY_LIVE_URL override.
 * Outputs: pass/fail against the live gateway; creates then deletes a
 *          throwaway monitor under a throwaway tenant (e2e-mobile-*@nself.org).
 * Constraints: Never runs in default CI (network + shared SaaS state).
 *          Run: NSENTRY_LIVE_E2E=1 pnpm vitest run live-smoke
 * SPORT: F13-CROSS-REPO-DEPS — @nself/nsentry-client (nsentry repo)
 */
import { describe, expect, it } from 'vitest';
import { NSENTRY_SAAS_API_URL, NsentryClient, isComingOnline } from '../index';

const LIVE = process.env.NSENTRY_LIVE_E2E === '1';
const BASE_URL = process.env.NSENTRY_LIVE_URL ?? NSENTRY_SAAS_API_URL;

describe.skipIf(!LIVE)('live gateway smoke (opt-in: NSENTRY_LIVE_E2E=1)', () => {
  const stamp = Date.now();
  const email = `e2e-mobile-${stamp}@nself.org`;
  const password = `E2e!${stamp}z`;
  let token: string | null = null;

  const api = () =>
    new NsentryClient({ baseUrl: BASE_URL, getAccessToken: async () => token });

  it('signs up a throwaway tenant and logs in for a session JWT', async () => {
    // Signup is not a client method (the app never self-signs-up) — raw call.
    const res = await fetch(`${BASE_URL}/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'mobile live-smoke' }),
    });
    expect([200, 201]).toContain(res.status);

    const session = await api().login(email, password);
    expect(session.token.length).toBeGreaterThan(20);
    token = session.token;
  });

  it('GET /v1/session + /v1/me + /v1/overview map to view models', async () => {
    const session = await api().session();
    expect(session.email).toBe(email);

    const me = await api().me();
    expect(me.tier.length).toBeGreaterThan(0);

    const overview = await api().overview();
    expect(overview.monitors.total).toBeGreaterThanOrEqual(0);
    expect(overview.incidentsOpen).toBeGreaterThanOrEqual(0);
  });

  it('monitor lifecycle: create → list → pause → resume → delete', async () => {
    const created = await api().createMonitor({
      name: 'live-smoke monitor',
      url: 'https://nself.org',
      intervalSeconds: 300,
    });
    expect(created.id.length).toBeGreaterThan(0);
    expect(created.url).toBe('https://nself.org');

    const listed = await api().listMonitors();
    expect(listed.some((m) => m.id === created.id)).toBe(true);

    const paused = await api().pauseMonitor(created.id);
    expect(paused.paused).toBe(true);
    const resumed = await api().resumeMonitor(created.id);
    expect(resumed.paused).toBe(false);

    await api().deleteMonitor(created.id);
    const after = await api().listMonitors();
    expect(after.some((m) => m.id === created.id)).toBe(false);
  });

  it('incidents + status pages list without error', async () => {
    expect(Array.isArray(await api().listIncidents())).toBe(true);
    expect(Array.isArray(await api().listStatusPages())).toBe(true);
  });

  it('push register is live OR surfaces the graceful coming-online state', async () => {
    try {
      await api().registerPushToken({ token: `ExponentPushToken[e2e-${stamp}]`, platform: 'expo' });
      // Route landed (G-GATEWAY) — registration accepted.
    } catch (err) {
      // Route not deployed yet — MUST map to the graceful state, never a crash.
      expect(isComingOnline(err)).toBe(true);
    }
  });
});
