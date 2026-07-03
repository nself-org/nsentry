/**
 * @nself/nsentry-client — offline mock server.
 *
 * Purpose: In-memory fetch-compatible implementation of the ɳSentry REST API v1
 *          for offline development, demos, and tests. Backs the mobile app's
 *          "Demo mode" so the app is fully explorable without any backend.
 * Inputs:  Optional fixture overrides (monitors / incidents / status pages).
 * Outputs: createMockFetch() — plug into NsentryClient({ fetchFn }).
 * Constraints:
 *   - Speaks the SAME wire contract as the live gateway (enveloped snake_case,
 *     {"error":{"code","message"}} errors) so the client's mapping layer is
 *     exercised identically in demo mode and against api.sentry.nself.org.
 *   - Route set mirrors the gateway: /v1/login, /v1/session, /v1/me,
 *     /v1/overview, /v1/monitors[...], /v1/incidents/{id}/ack|resolve,
 *     /v1/status-pages, /v1/status/public/{slug}. /v1/push/register returns
 *     404 exactly like the live gateway (push backend pending — G-GATEWAY).
 *   - State is mutable in-memory (create/pause/ack/resolve work), never persisted.
 *   - No Node-only APIs — must run in React Native's JS runtime.
 * SPORT: F13-CROSS-REPO-DEPS — @nself/nsentry-client (nsentry repo)
 */

import type { FetchFn } from './client';
import type {
  WireIncident,
  WireMe,
  WireMonitor,
  WireMonitorCheck,
  WirePublicStatusPage,
  WireStatusPage,
} from './wire';

/** Mutable mock state — wire-shaped, exactly what the gateway would return. */
export interface MockFixtures {
  me: WireMe;
  monitors: WireMonitor[];
  /** Per-monitor recent probe results (newest first). */
  checks: Record<string, WireMonitorCheck[]>;
  incidents: WireIncident[];
  statusPages: WireStatusPage[];
  publicStatus: Record<string, WirePublicStatusPage>;
}

const NOW = Date.now();
const iso = (msAgo: number): string => new Date(NOW - msAgo).toISOString();

/** Build the default demo fixtures (fresh copy each call — safe to mutate). */
export function defaultFixtures(): MockFixtures {
  const monitors: WireMonitor[] = [
    {
      id: 'mon_web',
      name: 'Marketing site',
      url: 'https://example.org',
      kind: 'https',
      interval_seconds: 300,
      status: 'up',
      paused: false,
      created_at: iso(86_400_000 * 30),
    },
    {
      id: 'mon_api',
      name: 'API',
      url: 'https://api.example.org/healthz',
      kind: 'https',
      interval_seconds: 60,
      status: 'down',
      paused: false,
      created_at: iso(86_400_000 * 20),
    },
    {
      id: 'mon_docs',
      name: 'Docs',
      url: 'https://docs.example.org',
      kind: 'https',
      interval_seconds: 300,
      status: 'paused',
      paused: true,
      created_at: iso(86_400_000 * 10),
    },
  ];

  const mkChecks = (down: boolean): WireMonitorCheck[] =>
    Array.from({ length: 12 }, (_, i) => ({
      checked_at: iso(i * 300_000),
      status: down && i < 3 ? 'down' : 'up',
      latency_ms: down && i < 3 ? null : 80 + i * 7,
    }));

  const incidents: WireIncident[] = [
    {
      id: 'inc_1',
      monitor_id: 'mon_api',
      title: 'API returning 503 from eu-central',
      status: 'open',
      severity: 'critical',
      started_at: iso(1_800_000),
    },
    {
      id: 'inc_2',
      monitor_id: 'mon_web',
      title: 'Elevated latency on marketing site',
      status: 'resolved',
      severity: 'minor',
      started_at: iso(86_400_000 * 2),
      acknowledged_at: iso(86_400_000 * 2 - 600_000),
      resolved_at: iso(86_400_000 * 2 - 3_600_000),
    },
  ];

  const statusPages: WireStatusPage[] = [
    {
      id: 'sp_1',
      name: 'Example.org Status',
      slug: 'demo',
      url: 'https://status.example.org/s/demo',
      public: true,
      created_at: iso(86_400_000 * 30),
    },
  ];

  const publicStatus: Record<string, WirePublicStatusPage> = {
    demo: {
      title: 'Example.org Status',
      slug: 'demo',
      overall_status: 'degraded',
      components: [
        { id: 'cmp_1', name: 'Website', status: 'operational', uptime_percent: 99.98 },
        { id: 'cmp_2', name: 'API', status: 'down', uptime_percent: 97.21 },
        { id: 'cmp_3', name: 'Docs', status: 'operational', uptime_percent: null },
      ],
      incidents: [
        { title: 'API returning 503 from eu-central', status: 'open', started_at: iso(1_800_000) },
      ],
      generated_at: iso(0),
    },
  };

  const me: WireMe = {
    tenant_id: 'ten_demo',
    email: 'demo@nself.org',
    tier: 'free',
    quotas: {
      monitors: { used: monitors.length, limit: 10 },
      status_pages: { used: 1, limit: 1 },
      error_events_month: { used: 1240, limit: 5000 },
      rum_pageviews_month: { used: 0, limit: 10000 },
      heartbeats: { used: 0, limit: 3 },
    },
  };

  return {
    me,
    monitors,
    checks: { mon_web: mkChecks(false), mon_api: mkChecks(true), mon_docs: [] },
    incidents,
    statusPages,
    publicStatus,
  };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Gateway-shaped error envelope: {"error":{"code","message"}}. */
const errJson = (status: number, code: string, message: string): Response =>
  json({ error: { code, message } }, status);

const notFound = (what: string): Response => errJson(404, 'not_found', `${what} not found`);

let idCounter = 0;
const nextId = (prefix: string): string => `${prefix}_mock_${++idCounter}`;

/** Demo credentials accepted by the mock /v1/login. */
export const MOCK_LOGIN = { email: 'demo@nself.org', password: 'demo1234' } as const;

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

    // ── Auth ──────────────────────────────────────────────────────────────
    if (method === 'POST' && path === '/v1/login') {
      if (body.email === MOCK_LOGIN.email && body.password === MOCK_LOGIN.password) {
        return json({
          token: 'mock_session_jwt',
          tenant_id: state.me.tenant_id,
          email: state.me.email,
          tier: state.me.tier,
          name: 'Demo tenant',
          expires_in: 7 * 24 * 3600,
        });
      }
      return errJson(401, 'invalid_credentials', 'invalid email or password');
    }
    if (method === 'GET' && path === '/v1/session') {
      return json({
        authenticated: true,
        tenant_id: state.me.tenant_id,
        email: state.me.email,
        tier: state.me.tier,
        name: 'Demo tenant',
      });
    }

    // ── /v1/me + /v1/overview ─────────────────────────────────────────────
    if (method === 'GET' && path === '/v1/me') return json(state.me);
    if (method === 'GET' && path === '/v1/overview') {
      const by = (s: string) => state.monitors.filter((m) => m.status === s).length;
      return json({
        overview: {
          monitors: {
            total: state.monitors.length,
            up: by('up'),
            down: by('down'),
            paused: by('paused'),
            pending: by('pending'),
          },
          incidents: { open: state.incidents.filter((i) => i.status === 'open').length },
          uptime_percent_24h: 99.42,
        },
      });
    }

    // ── /v1/monitors ──────────────────────────────────────────────────────
    if (path === '/v1/monitors') {
      if (method === 'GET') return json({ monitors: state.monitors });
      if (method === 'POST') {
        const limit = state.me.quotas?.monitors?.limit ?? 10;
        if (state.monitors.length >= limit) {
          return errJson(402, 'quota_exceeded', 'Monitor quota reached for tier');
        }
        const monitor: WireMonitor = {
          id: nextId('mon'),
          name: String(body.name ?? 'Unnamed'),
          url: String(body.url ?? ''),
          kind: String(body.kind ?? 'https'),
          interval_seconds: Number(body.interval_seconds ?? 300),
          status: 'pending',
          paused: false,
          created_at: new Date().toISOString(),
        };
        state.monitors.push(monitor);
        if (state.me.quotas?.monitors) state.me.quotas.monitors.used = state.monitors.length;
        return json({ monitor }, 201);
      }
    }

    const monMatch = path.match(/^\/v1\/monitors\/([^/]+)(?:\/(checks|pause|resume))?$/);
    if (monMatch) {
      const [, rawId, sub] = monMatch;
      const id = decodeURIComponent(rawId ?? '');
      const monitor = state.monitors.find((m) => m.id === id);
      if (!monitor) return notFound('monitor');

      if (sub === 'checks' && method === 'GET') {
        const limit = Number(url.searchParams.get('limit') ?? 60);
        return json({ checks: (state.checks[id] ?? []).slice(0, limit) });
      }
      if (sub === 'pause' && method === 'POST') {
        monitor.status = 'paused';
        monitor.paused = true;
        return json({ monitor });
      }
      if (sub === 'resume' && method === 'POST') {
        monitor.status = 'pending';
        monitor.paused = false;
        return json({ monitor });
      }
      if (!sub && method === 'PATCH') {
        if (typeof body.name === 'string') monitor.name = body.name;
        if (typeof body.url === 'string') monitor.url = body.url;
        if (typeof body.interval_seconds === 'number') monitor.interval_seconds = body.interval_seconds;
        if (typeof body.paused === 'boolean') {
          monitor.paused = body.paused;
          monitor.status = body.paused ? 'paused' : 'pending';
        }
        return json({ monitor });
      }
      if (!sub && method === 'DELETE') {
        state.monitors = state.monitors.filter((m) => m.id !== id);
        if (state.me.quotas?.monitors) state.me.quotas.monitors.used = state.monitors.length;
        return new Response(null, { status: 204 });
      }
    }

    // ── /v1/incidents ─────────────────────────────────────────────────────
    if (method === 'GET' && path === '/v1/incidents') {
      return json({ incidents: state.incidents });
    }

    const incMatch = path.match(/^\/v1\/incidents\/([^/]+)\/(ack|resolve)$/);
    if (incMatch && method === 'POST') {
      const [, rawId, action] = incMatch;
      const id = decodeURIComponent(rawId ?? '');
      const incident = state.incidents.find((i) => i.id === id);
      if (!incident) return notFound('incident');

      if (action === 'ack') {
        incident.status = 'acknowledged';
        incident.acknowledged_at = new Date().toISOString();
      } else {
        incident.status = 'resolved';
        incident.resolved_at = new Date().toISOString();
      }
      return json({ incident });
    }

    // ── /v1/status-pages (registry) ───────────────────────────────────────
    if (method === 'GET' && path === '/v1/status-pages') {
      return json({ status_pages: state.statusPages });
    }

    // ── /v1/status/public/{slug} (unauthenticated) ────────────────────────
    const pubMatch = path.match(/^\/v1\/status\/public\/([^/]+)$/);
    if (pubMatch && method === 'GET') {
      const slug = decodeURIComponent(pubMatch[1] ?? '');
      const page = state.publicStatus[slug];
      return page ? json({ status_page: page }) : notFound('status page');
    }

    // ── /v1/push/register — mirrors LIVE gateway (route pending, G-GATEWAY) ─
    if (method === 'POST' && path === '/v1/push/register') {
      return errJson(404, 'not_found', 'push registration is not available on this gateway yet');
    }

    return notFound(`route ${method} ${path}`);
  };
}
