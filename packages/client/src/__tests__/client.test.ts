/**
 * Purpose: Unit tests for NsentryClient against the in-memory mock server —
 *          verifies the typed contract, auth header injection, and error paths.
 * Inputs:  createMockFetch() fixtures.
 * Outputs: vitest assertions.
 * Constraints: No network. The mock IS the offline dev fallback, so these
 *              tests also pin the mock's route coverage.
 */

import { describe, expect, it, vi } from 'vitest';
import { NsentryApiError, NsentryClient } from '../client';
import { createMockFetch, defaultFixtures } from '../mock';

const makeClient = () => new NsentryClient({ apiKey: 'nsk_test', fetchFn: createMockFetch() });

describe('NsentryClient + mock server', () => {
  it('returns tenant info from /v1/me', async () => {
    const api = makeClient();
    const me = await api.me();
    expect(me.tenantId).toBe('ten_demo');
    expect(me.tier).toBe('free');
    expect(me.quotas.monitors).toBe(10);
  });

  it('lists and filters monitors', async () => {
    const api = makeClient();
    const all = await api.listMonitors();
    expect(all.total).toBe(3);
    const down = await api.listMonitors({ status: 'down' });
    expect(down.items.map((m) => m.id)).toEqual(['mon_api']);
  });

  it('creates, pauses, resumes, and deletes a monitor', async () => {
    const api = makeClient();
    const created = await api.createMonitor({ name: 'New', url: 'https://new.example.org' });
    expect(created.status).toBe('pending');

    const paused = await api.pauseMonitor(created.id);
    expect(paused.status).toBe('paused');

    const resumed = await api.resumeMonitor(created.id);
    expect(resumed.status).toBe('pending');

    await api.deleteMonitor(created.id);
    await expect(api.getMonitor(created.id)).rejects.toThrow(NsentryApiError);
  });

  it('enforces the tier monitor quota with a 402', async () => {
    const fixtures = defaultFixtures();
    fixtures.tenant.quotas.monitors = 3; // already at 3 monitors
    const api = new NsentryClient({ fetchFn: createMockFetch(fixtures) });
    await expect(api.createMonitor({ name: 'x', url: 'https://x.org' })).rejects.toMatchObject({
      status: 402,
      code: 'quota_exceeded',
    });
  });

  it('lists checks for a monitor', async () => {
    const api = makeClient();
    const checks = await api.listChecks('mon_api');
    expect(checks.total).toBeGreaterThan(0);
    expect(checks.items.every((c) => c.monitorId === 'mon_api')).toBe(true);
  });

  it('walks the incident lifecycle: open → acknowledged → resolved', async () => {
    const api = makeClient();
    const open = await api.listIncidents({ status: 'open' });
    expect(open.items.length).toBe(1);
    const id = open.items[0]!.id;

    const acked = await api.acknowledgeIncident(id);
    expect(acked.status).toBe('acknowledged');
    expect(acked.acknowledgedAt).not.toBeNull();

    const resolved = await api.resolveIncident(id);
    expect(resolved.status).toBe('resolved');
    expect(resolved.updates.at(-1)?.status).toBe('resolved');
  });

  it('fetches a status page by slug', async () => {
    const api = makeClient();
    const page = await api.getStatusPage('demo');
    expect(page.name).toBe('Example.org Status');
    expect(page.components).toHaveLength(3);
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

  it('uses getAccessToken when no apiKey is set', async () => {
    const spy = vi.fn(createMockFetch());
    const api = new NsentryClient({
      getAccessToken: async () => 'jwt_xyz',
      fetchFn: spy,
    });
    await api.me();
    const init = spy.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt_xyz');
  });

  it('surfaces API errors as NsentryApiError with code + status', async () => {
    const api = makeClient();
    await expect(api.getIncident('nope')).rejects.toMatchObject({
      name: 'NsentryApiError',
      status: 404,
      code: 'not_found',
    });
  });
});
