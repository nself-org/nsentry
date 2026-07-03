/**
 * Purpose: Unit tests for NsentryClient against the in-memory mock server —
 *          verifies the live gateway contract (enveloped snake_case wire →
 *          camelCase view models), auth header injection, login, and error
 *          envelope parsing.
 * Inputs:  createMockFetch() fixtures (wire-shaped, mirroring the gateway).
 * Outputs: vitest assertions.
 * Constraints: No network. The mock IS the offline dev fallback, so these
 *              tests also pin the mock's route coverage to the live routes.
 */

import { describe, expect, it, vi } from 'vitest';
import { isComingOnline, NsentryApiError, NsentryClient } from '../client';
import { createMockFetch, defaultFixtures, MOCK_LOGIN } from '../mock';
import { mapIncident, mapMonitor, mapPublicStatusPage } from '../wire';

const makeClient = () => new NsentryClient({ apiKey: 'nsk_test', fetchFn: createMockFetch() });

describe('wire mapping (gateway snake_case → view models)', () => {
  it('maps a wire monitor', () => {
    const m = mapMonitor({
      id: 'mon_1',
      name: 'API',
      url: 'https://api.example.org',
      kind: 'https',
      interval_seconds: 60,
      status: 'up',
      paused: false,
      created_at: '2026-07-01T00:00:00Z',
    });
    expect(m).toEqual({
      id: 'mon_1',
      name: 'API',
      url: 'https://api.example.org',
      kind: 'https',
      intervalSeconds: 60,
      status: 'up',
      paused: false,
      createdAt: '2026-07-01T00:00:00Z',
    });
  });

  it('normalizes unknown incident severities to minor and empty monitor_id to null', () => {
    const i = mapIncident({
      id: 'inc_1',
      monitor_id: '',
      title: 'x',
      status: 'open',
      severity: 'catastrophic',
      started_at: '2026-07-01T00:00:00Z',
    });
    expect(i.severity).toBe('minor');
    expect(i.monitorId).toBeNull();
    expect(i.acknowledgedAt).toBeNull();
  });

  it('maps the public status-page envelope tolerantly', () => {
    const p = mapPublicStatusPage({
      status_page: {
        title: 'Status',
        slug: 's',
        overall_status: 'weird',
        components: [{ id: 'c1', name: 'API', status: 'bogus', uptime_percent: null }],
      },
    });
    expect(p.overallStatus).toBe('operational');
    expect(p.components[0]?.status).toBe('unknown');
    expect(p.incidents).toEqual([]);
    expect(mapPublicStatusPage({}).title).toBe('');
  });
});

describe('NsentryClient + mock server (live route set)', () => {
  it('logs in with email/password and maps the session (POST /v1/login)', async () => {
    const api = new NsentryClient({ fetchFn: createMockFetch() });
    const session = await api.login(MOCK_LOGIN.email, MOCK_LOGIN.password);
    expect(session.token).toBeTruthy();
    expect(session.tenantId).toBe('ten_demo');
    expect(session.expiresIn).toBeGreaterThan(0);

    await expect(api.login(MOCK_LOGIN.email, 'wrong')).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
    });
  });

  it('returns tenant info with quota dims from /v1/me', async () => {
    const api = makeClient();
    const me = await api.me();
    expect(me.tenantId).toBe('ten_demo');
    expect(me.tier).toBe('free');
    expect(me.quotas.monitors).toEqual({ used: 3, limit: 10 });
    expect(me.quotas.status_pages?.limit).toBe(1);
  });

  it('lists monitors from the {"monitors":[...]} envelope', async () => {
    const api = makeClient();
    const all = await api.listMonitors();
    expect(all).toHaveLength(3);
    expect(all.map((m) => m.id)).toContain('mon_api');
    expect(all[0]?.intervalSeconds).toBe(300);
  });

  it('creates, pauses, resumes, and deletes a monitor', async () => {
    const api = makeClient();
    const created = await api.createMonitor({ name: 'New', url: 'https://new.example.org' });
    expect(created.status).toBe('pending');
    expect(created.kind).toBe('https');

    const paused = await api.pauseMonitor(created.id);
    expect(paused.status).toBe('paused');
    expect(paused.paused).toBe(true);

    const resumed = await api.resumeMonitor(created.id);
    expect(resumed.status).toBe('pending');

    await api.deleteMonitor(created.id);
    await expect(api.getMonitor(created.id)).rejects.toThrow(NsentryApiError);
  });

  it('updates a monitor via PATCH with snake_case body', async () => {
    const spy = vi.fn(createMockFetch());
    const api = new NsentryClient({ apiKey: 'nsk_t', fetchFn: spy });
    const updated = await api.updateMonitor('mon_web', { intervalSeconds: 120, paused: true });
    expect(updated.intervalSeconds).toBe(120);
    expect(updated.status).toBe('paused');
    const init = spy.mock.calls.at(-1)?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ interval_seconds: 120, paused: true });
  });

  it('enforces the tier monitor quota with a 402', async () => {
    const fixtures = defaultFixtures();
    fixtures.me.quotas!.monitors = { used: 3, limit: 3 };
    const api = new NsentryClient({ apiKey: 'nsk_t', fetchFn: createMockFetch(fixtures) });
    await expect(api.createMonitor({ name: 'x', url: 'https://x.org' })).rejects.toMatchObject({
      status: 402,
      code: 'quota_exceeded',
    });
  });

  it('lists checks for a monitor ({"checks":[...]} envelope)', async () => {
    const api = makeClient();
    const checks = await api.listChecks('mon_api', { limit: 5 });
    expect(checks).toHaveLength(5);
    expect(checks[0]).toHaveProperty('checkedAt');
    expect(checks[0]).toHaveProperty('latencyMs');
  });

  it('walks the incident lifecycle via /ack and /resolve', async () => {
    const api = makeClient();
    const open = await api.listIncidents({ status: 'open' });
    expect(open).toHaveLength(1);
    const id = open[0]!.id;

    const acked = await api.acknowledgeIncident(id);
    expect(acked.status).toBe('acknowledged');
    expect(acked.acknowledgedAt).not.toBeNull();

    const resolved = await api.resolveIncident(id);
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it('lists the status-page registry and fetches the public page by slug', async () => {
    const api = makeClient();
    const pages = await api.listStatusPages();
    expect(pages[0]?.slug).toBe('demo');
    expect(pages[0]?.public).toBe(true);

    const pub = await api.getPublicStatus('demo');
    expect(pub.title).toBe('Example.org Status');
    expect(pub.overallStatus).toBe('degraded');
    expect(pub.components).toHaveLength(3);
    expect(pub.components[0]?.uptimePercent).toBe(99.98);
  });

  it('sends Bearer auth and hits the configured base URL', async () => {
    const spy = vi.fn(createMockFetch());
    const api = new NsentryClient({
      baseUrl: 'https://sentry.selfhosted.example/',
      apiKey: 'nsk_abc',
      fetchFn: spy,
    });
    await api.me();
    expect(spy).toHaveBeenCalledWith(
      'https://sentry.selfhosted.example/v1/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer nsk_abc' }),
      }),
    );
  });

  it('uses getAccessToken when no apiKey is set, and no auth on login/public', async () => {
    const spy = vi.fn(createMockFetch());
    const api = new NsentryClient({ getAccessToken: async () => 'jwt_xyz', fetchFn: spy });
    await api.me();
    let init = spy.mock.calls.at(-1)?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt_xyz');

    await api.getPublicStatus('demo');
    init = spy.mock.calls.at(-1)?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('parses the gateway error envelope {"error":{code,message}}', async () => {
    const api = makeClient();
    await expect(api.getPublicStatus('nope')).rejects.toMatchObject({
      name: 'NsentryApiError',
      status: 404,
      code: 'not_found',
    });
  });

  it('flags not-yet-live routes as coming-online (push register 404)', async () => {
    const api = makeClient();
    try {
      await api.registerPushToken({ token: 'ExponentPushToken[x]', platform: 'expo' });
      expect.unreachable('push register should 404 like the live gateway');
    } catch (e) {
      expect(isComingOnline(e)).toBe(true);
    }
    expect(isComingOnline(new NsentryApiError(401, 'unauthorized', 'x'))).toBe(false);
    expect(isComingOnline(new Error('network'))).toBe(false);
  });
});
