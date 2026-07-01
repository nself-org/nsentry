/**
 * @nself/nsentry-client — offline mock server.
 *
 * Purpose: In-memory fetch-compatible implementation of the ɳSentry REST API v1
 *          for offline development, demos, and tests. Backs the mobile app's
 *          "Demo mode" so the app is fully explorable without any backend.
 * Inputs:  Optional fixture overrides (monitors / incidents / status pages).
 * Outputs: createMockFetch() — plug into NsentryClient({ fetchFn }).
 * Constraints:
 *   - Implements the same routes as client.ts; state is mutable in-memory
 *     (create/pause/ack/resolve work) but never persisted.
 *   - No Node-only APIs — must run in React Native's JS runtime.
 * SPORT: F13-CROSS-REPO-DEPS — @nself/nsentry-client (nsentry repo)
 */

import type { FetchFn } from './client';
import type {
  CheckResult,
  Incident,
  Monitor,
  StatusPage,
  TenantInfo,
} from './types';

/** Mutable mock state. */
export interface MockFixtures {
  tenant: TenantInfo;
  monitors: Monitor[];
  checks: CheckResult[];
  incidents: Incident[];
  statusPages: StatusPage[];
}

const NOW = Date.now();
const iso = (msAgo: number): string => new Date(NOW - msAgo).toISOString();

/** Build the default demo fixtures (fresh copy each call — safe to mutate). */
export function defaultFixtures(): MockFixtures {
  const monitors: Monitor[] = [
    {
      id: 'mon_web',
      name: 'Marketing site',
      url: 'https://example.org',
      method: 'GET',
      intervalSeconds: 300,
      timeoutMs: 10000,
      status: 'up',
      regions: ['eu-central'],
      lastCheckAt: iso(60_000),
      uptime24h: 1,
      uptime30d: 0.9998,
      latencyP50Ms: 142,
      createdAt: iso(86_400_000 * 30),
    },
    {
      id: 'mon_api',
      name: 'API',
      url: 'https://api.example.org/healthz',
      method: 'GET',
      intervalSeconds: 300,
      timeoutMs: 10000,
      status: 'down',
      regions: ['eu-central', 'us-east'],
      lastCheckAt: iso(30_000),
      uptime24h: 0.921,
      uptime30d: 0.9971,
      latencyP50Ms: 88,
      createdAt: iso(86_400_000 * 20),
    },
    {
      id: 'mon_docs',
      name: 'Docs',
      url: 'https://docs.example.org',
      method: 'HEAD',
      intervalSeconds: 300,
      timeoutMs: 10000,
      status: 'paused',
      regions: ['eu-central'],
      lastCheckAt: iso(86_400_000),
      uptime24h: null,
      uptime30d: 0.9989,
      latencyP50Ms: 201,
      createdAt: iso(86_400_000 * 10),
    },
  ];

  const checks: CheckResult[] = Array.from({ length: 12 }, (_, i) => ({
    id: `chk_${i}`,
    monitorId: i % 3 === 0 ? 'mon_api' : 'mon_web',
    region: i % 2 === 0 ? 'eu-central' : 'us-east',
    ok: !(i % 3 === 0 && i < 4),
    statusCode: i % 3 === 0 && i < 4 ? 503 : 200,
    latencyMs: 80 + i * 7,
    checkedAt: iso(i * 300_000),
    error: i % 3 === 0 && i < 4 ? 'HTTP 503 Service Unavailable' : null,
  }));

  const incidents: Incident[] = [
    {
      id: 'inc_1',
      monitorId: 'mon_api',
      title: 'API returning 503 from eu-central',
      status: 'open',
      severity: 'critical',
      startedAt: iso(1_800_000),
      acknowledgedAt: null,
      resolvedAt: null,
      updates: [
        { id: 'iu_1', status: 'open', message: 'Auto-opened: 3 consecutive failed checks.', createdAt: iso(1_800_000) },
      ],
    },
    {
      id: 'inc_2',
      monitorId: 'mon_web',
      title: 'Elevated latency on marketing site',
      status: 'resolved',
      severity: 'minor',
      startedAt: iso(86_400_000 * 2),
      acknowledgedAt: iso(86_400_000 * 2 - 600_000),
      resolvedAt: iso(86_400_000 * 2 - 3_600_000),
      updates: [
        { id: 'iu_2', status: 'open', message: 'p50 latency above 800ms.', createdAt: iso(86_400_000 * 2) },
        { id: 'iu_3', status: 'resolved', message: 'CDN config rolled back.', createdAt: iso(86_400_000 * 2 - 3_600_000) },
      ],
    },
  ];

  const statusPages: StatusPage[] = [
    {
      id: 'sp_1',
      slug: 'demo',
      name: 'Example.org Status',
      overallStatus: 'partial_outage',
      uptime90d: 0.9993,
      components: [
        { id: 'cmp_1', name: 'Website', status: 'operational' },
        { id: 'cmp_2', name: 'API', status: 'major_outage' },
        { id: 'cmp_3', name: 'Docs', status: 'operational' },
      ],
    },
  ];

  const tenant: TenantInfo = {
    tenantId: 'ten_demo',
    name: 'Demo tenant',
    tier: 'free',
    quotas: { monitors: 10, minIntervalSeconds: 300, statusPages: 1, retentionDays: 7, seats: 1 },
  };

  return { tenant, monitors, checks, incidents, statusPages };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const notFound = (what: string): Response =>
  json({ code: 'not_found', message: `${what} not found` }, 404);

let idCounter = 0;
const nextId = (prefix: string): string => `${prefix}_mock_${++idCounter}`;

/**
 * createMockFetch — fetch-compatible ɳSentry API v1 backed by in-memory fixtures.
 *
 * Usage:
 *   const api = new NsentryClient({ fetchFn: createMockFetch() });
 */
export function createMockFetch(fixtures: MockFixtures = defaultFixtures()): FetchFn {
  const state = fixtures;

  return async (input: string, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const url = new URL(input, 'http://mock.local');
    const path = url.pathname;
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

    // ── /v1/me ────────────────────────────────────────────────────────────
    if (method === 'GET' && path === '/v1/me') return json(state.tenant);

    // ── /v1/monitors ──────────────────────────────────────────────────────
    if (path === '/v1/monitors') {
      if (method === 'GET') {
        const status = url.searchParams.get('status');
        const items = status ? state.monitors.filter((m) => m.status === status) : state.monitors;
        return json({ items, total: items.length });
      }
      if (method === 'POST') {
        const monitor: Monitor = {
          id: nextId('mon'),
          name: String(body.name ?? 'Unnamed'),
          url: String(body.url ?? ''),
          method: (body.method as Monitor['method']) ?? 'GET',
          intervalSeconds: Number(body.intervalSeconds ?? state.tenant.quotas.minIntervalSeconds),
          timeoutMs: Number(body.timeoutMs ?? 10000),
          status: 'pending',
          regions: (body.regions as string[]) ?? ['eu-central'],
          lastCheckAt: null,
          uptime24h: null,
          uptime30d: null,
          latencyP50Ms: null,
          createdAt: new Date().toISOString(),
        };
        if (state.monitors.length >= state.tenant.quotas.monitors) {
          return json({ code: 'quota_exceeded', message: 'Monitor quota reached for tier' }, 402);
        }
        state.monitors.push(monitor);
        return json(monitor, 201);
      }
    }

    const monMatch = path.match(/^\/v1\/monitors\/([^/]+)(?:\/(checks|pause|resume))?$/);
    if (monMatch) {
      const [, rawId, sub] = monMatch;
      const id = decodeURIComponent(rawId ?? '');
      const monitor = state.monitors.find((m) => m.id === id);
      if (!monitor) return notFound('monitor');

      if (sub === 'checks' && method === 'GET') {
        const items = state.checks.filter((c) => c.monitorId === id);
        return json({ items, total: items.length });
      }
      if (sub === 'pause' && method === 'POST') {
        monitor.status = 'paused';
        return json(monitor);
      }
      if (sub === 'resume' && method === 'POST') {
        monitor.status = 'pending';
        return json(monitor);
      }
      if (!sub && method === 'GET') return json(monitor);
      if (!sub && method === 'PATCH') {
        Object.assign(monitor, body);
        return json(monitor);
      }
      if (!sub && method === 'DELETE') {
        state.monitors = state.monitors.filter((m) => m.id !== id);
        return new Response(null, { status: 204 });
      }
    }

    // ── /v1/incidents ─────────────────────────────────────────────────────
    if (method === 'GET' && path === '/v1/incidents') {
      const status = url.searchParams.get('status');
      const items = status ? state.incidents.filter((i) => i.status === status) : state.incidents;
      return json({ items, total: items.length });
    }

    const incMatch = path.match(/^\/v1\/incidents\/([^/]+)(?:\/(acknowledge|resolve))?$/);
    if (incMatch) {
      const [, rawId, action] = incMatch;
      const id = decodeURIComponent(rawId ?? '');
      const incident = state.incidents.find((i) => i.id === id);
      if (!incident) return notFound('incident');

      if (!action && method === 'GET') return json(incident);
      if (action === 'acknowledge' && method === 'POST') {
        incident.status = 'acknowledged';
        incident.acknowledgedAt = new Date().toISOString();
        incident.updates.push({
          id: nextId('iu'),
          status: 'acknowledged',
          message: 'Acknowledged via API.',
          createdAt: new Date().toISOString(),
        });
        return json(incident);
      }
      if (action === 'resolve' && method === 'POST') {
        incident.status = 'resolved';
        incident.resolvedAt = new Date().toISOString();
        incident.updates.push({
          id: nextId('iu'),
          status: 'resolved',
          message: 'Resolved via API.',
          createdAt: new Date().toISOString(),
        });
        return json(incident);
      }
    }

    // ── /v1/status-pages ──────────────────────────────────────────────────
    if (method === 'GET' && path === '/v1/status-pages') {
      return json({ items: state.statusPages, total: state.statusPages.length });
    }
    const spMatch = path.match(/^\/v1\/status-pages\/([^/]+)$/);
    if (spMatch && method === 'GET') {
      const slug = decodeURIComponent(spMatch[1] ?? '');
      const page = state.statusPages.find((p) => p.slug === slug || p.id === slug);
      return page ? json(page) : notFound('status page');
    }

    return notFound(`route ${method} ${path}`);
  };
}
