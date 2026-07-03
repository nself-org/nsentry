/**
 * @nself/nsentry-client — NsentryClient.
 *
 * Purpose: Typed fetch-based client for the ɳSentry REST API v1. Works against
 *          the hosted SaaS (https://api.sentry.nself.org) or any self-hosted
 *          nSelf deploy running the Sentry Bundle plugins — same contract.
 * Inputs:  NsentryClientConfig — baseUrl, API key (nsk_*) OR a session-token
 *          provider, optional fetchFn injection (offline mock + tests).
 * Outputs: Typed methods for auth / monitors / incidents / status pages /
 *          tenant info / overview — mapped view models (wire.ts).
 * Constraints:
 *   - Zero runtime dependencies — publishable standalone; RN/browser/Node safe.
 *   - Errors surface as NsentryApiError (never bare fetch throws for HTTP
 *     errors). Wire error envelope: {"error":{"code","message"}}.
 *   - Auth: `Authorization: Bearer <apiKey|session JWT>`. POST /v1/login and
 *     GET /v1/status/public/{slug} are the unauthenticated endpoints.
 *   - Routes not yet live on every gateway build (e.g. /v1/monitors/{id}/checks,
 *     /v1/push/register) surface a 404 NsentryApiError — callers use
 *     isComingOnline() to render "coming online" instead of an error.
 * SPORT: F13-CROSS-REPO-DEPS — @nself/nsentry-client (nsentry repo)
 */

import type {
  CreateMonitorInput,
  Incident,
  IncidentStatus,
  LoginSession,
  Monitor,
  MonitorCheck,
  Overview,
  PublicStatusPage,
  SessionInfo,
  StatusPage,
  TenantInfo,
  UpdateMonitorInput,
} from './types';
import {
  mapIncident,
  mapIncidents,
  mapLogin,
  mapMe,
  mapMonitor,
  mapMonitorChecks,
  mapMonitors,
  mapOverview,
  mapPublicStatusPage,
  mapSession,
  mapStatusPages,
  monitorKindFromUrl,
  type WireIncident,
  type WireLogin,
  type WireMe,
  type WireMonitor,
  type WireMonitorCheck,
  type WireOverview,
  type WirePublicStatusPage,
  type WireSession,
  type WireStatusPage,
} from './wire';

/** Default hosted SaaS API endpoint. */
export const NSENTRY_SAAS_API_URL = 'https://api.sentry.nself.org';

/** Fetch-compatible function type — injectable for mocks and tests. */
export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Client configuration. Provide `apiKey` (nsk_*) or `getAccessToken` (session JWT). */
export interface NsentryClientConfig {
  /** API base URL — defaults to the hosted SaaS. Point at your own deploy for self-host. */
  baseUrl?: string;
  /** Long-lived API key (nsk_*) — created in the ɳSentry dashboard or `nself sentry` CLI. */
  apiKey?: string;
  /** Alternative to apiKey: async session-JWT provider (token from login()). */
  getAccessToken?: () => Promise<string | null>;
  /** Inject a fetch implementation (offline mock, tests). Defaults to global fetch. */
  fetchFn?: FetchFn;
}

/** Typed API error — thrown for all non-2xx responses. */
export class NsentryApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'NsentryApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * True when an error means "this route is not on this gateway build yet"
 * (rolling out) — callers render a graceful "coming online" state, never a
 * crash. 404/405 on a known-contract route qualifies; auth errors do not.
 */
export function isComingOnline(err: unknown): boolean {
  return err instanceof NsentryApiError && (err.status === 404 || err.status === 405);
}

/**
 * NsentryClient — the single entry point apps use to talk to ɳSentry.
 *
 * Usage:
 *   const api = new NsentryClient({ apiKey: 'nsk_...' });               // SaaS
 *   const api = new NsentryClient({ baseUrl: 'https://sentry.my.org' }); // self-host
 */
export class NsentryClient {
  private readonly baseUrl: string;
  private readonly config: NsentryClientConfig;
  private readonly fetchFn: FetchFn;

  constructor(config: NsentryClientConfig = {}) {
    this.config = config;
    this.baseUrl = (config.baseUrl ?? NSENTRY_SAAS_API_URL).replace(/\/$/, '');
    this.fetchFn = config.fetchFn ?? ((input, init) => fetch(input, init));
  }

  // ── Auth ────────────────────────────────────────────────────────────────

  /** Email/password login → 7-day session JWT (POST /v1/login, unauthenticated). */
  async login(email: string, password: string): Promise<LoginSession> {
    const wire = await this.request<WireLogin>('POST', '/v1/login', { email, password }, { auth: false });
    return mapLogin(wire);
  }

  /** Verify the presented credential and echo the identity (GET /v1/session). */
  async session(): Promise<SessionInfo> {
    return mapSession(await this.request<WireSession>('GET', '/v1/session'));
  }

  // ── Tenant ──────────────────────────────────────────────────────────────

  /** Who am I — tenant, tier, and per-dimension quota usage. */
  async me(): Promise<TenantInfo> {
    return mapMe(await this.request<WireMe>('GET', '/v1/me'));
  }

  /** Dashboard overview — monitor counts, open incidents, 24h uptime. */
  async overview(): Promise<Overview> {
    return mapOverview(await this.request<{ overview?: WireOverview }>('GET', '/v1/overview'));
  }

  // ── Monitors ────────────────────────────────────────────────────────────

  async listMonitors(): Promise<Monitor[]> {
    return mapMonitors(await this.request<{ monitors?: WireMonitor[] }>('GET', '/v1/monitors'));
  }

  /**
   * Fetch one monitor. The gateway has no GET /v1/monitors/{id} route — this
   * resolves from the (tenant-scoped, small) list. Throws a 404-shaped
   * NsentryApiError when the id is absent.
   */
  async getMonitor(id: string): Promise<Monitor> {
    const monitors = await this.listMonitors();
    const monitor = monitors.find((m) => m.id === id);
    if (!monitor) throw new NsentryApiError(404, 'not_found', 'monitor not found');
    return monitor;
  }

  async createMonitor(input: CreateMonitorInput): Promise<Monitor> {
    const body = {
      name: input.name,
      url: input.url,
      kind: input.kind ?? monitorKindFromUrl(input.url),
      ...(input.intervalSeconds !== undefined ? { interval_seconds: input.intervalSeconds } : {}),
    };
    const wire = await this.request<{ monitor: WireMonitor }>('POST', '/v1/monitors', body);
    return mapMonitor(wire.monitor);
  }

  async updateMonitor(id: string, input: UpdateMonitorInput): Promise<Monitor> {
    const body: Record<string, unknown> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.url !== undefined) body.url = input.url;
    if (input.intervalSeconds !== undefined) body.interval_seconds = input.intervalSeconds;
    if (input.paused !== undefined) body.paused = input.paused;
    const wire = await this.request<{ monitor: WireMonitor }>(
      'PATCH',
      `/v1/monitors/${encodeURIComponent(id)}`,
      body,
    );
    return mapMonitor(wire.monitor);
  }

  async deleteMonitor(id: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/monitors/${encodeURIComponent(id)}`);
  }

  async pauseMonitor(id: string): Promise<Monitor> {
    const wire = await this.request<{ monitor: WireMonitor }>(
      'POST',
      `/v1/monitors/${encodeURIComponent(id)}/pause`,
    );
    return mapMonitor(wire.monitor);
  }

  async resumeMonitor(id: string): Promise<Monitor> {
    const wire = await this.request<{ monitor: WireMonitor }>(
      'POST',
      `/v1/monitors/${encodeURIComponent(id)}/resume`,
    );
    return mapMonitor(wire.monitor);
  }

  /**
   * Recent probe results (newest first). Rolling out on the SaaS gateway —
   * a 404 means "coming online" (check with isComingOnline), not a bug.
   */
  async listChecks(monitorId: string, opts: { limit?: number } = {}): Promise<MonitorCheck[]> {
    const qs = opts.limit !== undefined ? `?limit=${opts.limit}` : '';
    return mapMonitorChecks(
      await this.request<{ checks?: WireMonitorCheck[] }>(
        'GET',
        `/v1/monitors/${encodeURIComponent(monitorId)}/checks${qs}`,
      ),
    );
  }

  // ── Incidents ───────────────────────────────────────────────────────────

  async listIncidents(opts: { status?: IncidentStatus } = {}): Promise<Incident[]> {
    const incidents = mapIncidents(
      await this.request<{ incidents?: WireIncident[] }>('GET', '/v1/incidents'),
    );
    // The gateway list route has no status filter — filter client-side.
    return opts.status ? incidents.filter((i) => i.status === opts.status) : incidents;
  }

  /** POST /v1/incidents/{id}/ack */
  async acknowledgeIncident(id: string): Promise<Incident> {
    const wire = await this.request<{ incident: WireIncident }>(
      'POST',
      `/v1/incidents/${encodeURIComponent(id)}/ack`,
    );
    return mapIncident(wire.incident);
  }

  /** POST /v1/incidents/{id}/resolve */
  async resolveIncident(id: string): Promise<Incident> {
    const wire = await this.request<{ incident: WireIncident }>(
      'POST',
      `/v1/incidents/${encodeURIComponent(id)}/resolve`,
    );
    return mapIncident(wire.incident);
  }

  // ── Status pages ────────────────────────────────────────────────────────

  /** The tenant's status-page registry (authenticated). */
  async listStatusPages(): Promise<StatusPage[]> {
    return mapStatusPages(
      await this.request<{ status_pages?: WireStatusPage[] }>('GET', '/v1/status-pages'),
    );
  }

  /** The rendered PUBLIC status page (unauthenticated — same data visitors see). */
  async getPublicStatus(slug: string): Promise<PublicStatusPage> {
    return mapPublicStatusPage(
      await this.request<{ status_page?: WirePublicStatusPage }>(
        'GET',
        `/v1/status/public/${encodeURIComponent(slug)}`,
        undefined,
        { auth: false },
      ),
    );
  }

  // ── Push (down alerts) ──────────────────────────────────────────────────

  /**
   * Register a device push token for down alerts (POST /v1/push/register).
   * NOT live on the SaaS gateway yet (tracked for G-GATEWAY) — a 404 means
   * "push coming soon" (isComingOnline), which callers surface gracefully.
   */
  async registerPushToken(input: { token: string; platform: string }): Promise<void> {
    await this.request<void>('POST', '/v1/push/register', input);
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts: { auth?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    if (opts.auth !== false) {
      const token = this.config.apiKey ?? (await this.config.getAccessToken?.()) ?? null;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let code = 'unknown_error';
      let message = `HTTP ${res.status}`;
      try {
        // Gateway envelope: {"error":{"code","message"}}; tolerate bare {code,message}.
        const payload = (await res.json()) as {
          error?: { code?: string; message?: string };
          code?: string;
          message?: string;
        };
        code = payload.error?.code ?? payload.code ?? code;
        message = payload.error?.message ?? payload.message ?? message;
      } catch {
        // non-JSON error body — keep defaults
      }
      throw new NsentryApiError(res.status, code, message);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json().catch(() => undefined)) as T;
  }
}
