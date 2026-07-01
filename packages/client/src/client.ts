/**
 * @nself/nsentry-client — NsentryClient.
 *
 * Purpose: Typed fetch-based client for the ɳSentry REST API v1. Works against
 *          the hosted SaaS (https://api.sentry.nself.org) or any self-hosted
 *          nSelf deploy running the Sentry Bundle plugins — same contract.
 * Inputs:  NsentryClientConfig — baseUrl, API key (nsk_*) OR a JWT provider,
 *          optional fetchFn injection (used for the offline mock + tests).
 * Outputs: Typed methods for monitors / incidents / status pages / tenant info.
 * Constraints:
 *   - Zero runtime dependencies — publishable standalone; RN/browser/Node safe.
 *   - Errors surface as NsentryApiError (never bare fetch throws for HTTP errors).
 *   - Auth: `Authorization: Bearer <apiKey|jwt>` per the SaaS plan §4.
 * SPORT: F13-CROSS-REPO-DEPS — @nself/nsentry-client (nsentry repo)
 */

import type {
  CheckResult,
  CreateMonitorInput,
  Incident,
  IncidentStatus,
  Monitor,
  Page,
  StatusPage,
  TenantInfo,
  UpdateMonitorInput,
} from './types';

/** Default hosted SaaS API endpoint. */
export const NSENTRY_SAAS_API_URL = 'https://api.sentry.nself.org';

/** Fetch-compatible function type — injectable for mocks and tests. */
export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Client configuration. Provide `apiKey` (nsk_*) or `getAccessToken` (nself auth JWT). */
export interface NsentryClientConfig {
  /** API base URL — defaults to the hosted SaaS. Point at your own deploy for self-host. */
  baseUrl?: string;
  /** Long-lived API key (nsk_*) — created in the ɳSentry dashboard or `nself sentry` CLI. */
  apiKey?: string;
  /** Alternative to apiKey: async JWT provider (e.g. @nself/auth-core getAccessToken). */
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

interface ListMonitorsOptions {
  status?: Monitor['status'];
  limit?: number;
  offset?: number;
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

  // ── Tenant ──────────────────────────────────────────────────────────────

  /** Who am I — tenant, tier, and quotas for the presented credential. */
  me(): Promise<TenantInfo> {
    return this.request<TenantInfo>('GET', '/v1/me');
  }

  // ── Monitors ────────────────────────────────────────────────────────────

  listMonitors(opts: ListMonitorsOptions = {}): Promise<Page<Monitor>> {
    const params = new URLSearchParams();
    if (opts.status) params.set('status', opts.status);
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts.offset !== undefined) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return this.request<Page<Monitor>>('GET', `/v1/monitors${qs ? `?${qs}` : ''}`);
  }

  getMonitor(id: string): Promise<Monitor> {
    return this.request<Monitor>('GET', `/v1/monitors/${encodeURIComponent(id)}`);
  }

  createMonitor(input: CreateMonitorInput): Promise<Monitor> {
    return this.request<Monitor>('POST', '/v1/monitors', input);
  }

  updateMonitor(id: string, input: UpdateMonitorInput): Promise<Monitor> {
    return this.request<Monitor>('PATCH', `/v1/monitors/${encodeURIComponent(id)}`, input);
  }

  deleteMonitor(id: string): Promise<void> {
    return this.request<void>('DELETE', `/v1/monitors/${encodeURIComponent(id)}`);
  }

  pauseMonitor(id: string): Promise<Monitor> {
    return this.request<Monitor>('POST', `/v1/monitors/${encodeURIComponent(id)}/pause`);
  }

  resumeMonitor(id: string): Promise<Monitor> {
    return this.request<Monitor>('POST', `/v1/monitors/${encodeURIComponent(id)}/resume`);
  }

  /** Recent check results for a monitor (newest first). */
  listChecks(monitorId: string, opts: { since?: string; limit?: number } = {}): Promise<Page<CheckResult>> {
    const params = new URLSearchParams();
    if (opts.since) params.set('since', opts.since);
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return this.request<Page<CheckResult>>(
      'GET',
      `/v1/monitors/${encodeURIComponent(monitorId)}/checks${qs ? `?${qs}` : ''}`,
    );
  }

  // ── Incidents ───────────────────────────────────────────────────────────

  listIncidents(opts: { status?: IncidentStatus; limit?: number } = {}): Promise<Page<Incident>> {
    const params = new URLSearchParams();
    if (opts.status) params.set('status', opts.status);
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return this.request<Page<Incident>>('GET', `/v1/incidents${qs ? `?${qs}` : ''}`);
  }

  getIncident(id: string): Promise<Incident> {
    return this.request<Incident>('GET', `/v1/incidents/${encodeURIComponent(id)}`);
  }

  acknowledgeIncident(id: string): Promise<Incident> {
    return this.request<Incident>('POST', `/v1/incidents/${encodeURIComponent(id)}/acknowledge`);
  }

  resolveIncident(id: string): Promise<Incident> {
    return this.request<Incident>('POST', `/v1/incidents/${encodeURIComponent(id)}/resolve`);
  }

  // ── Status pages ────────────────────────────────────────────────────────

  listStatusPages(): Promise<Page<StatusPage>> {
    return this.request<Page<StatusPage>>('GET', '/v1/status-pages');
  }

  getStatusPage(slug: string): Promise<StatusPage> {
    return this.request<StatusPage>('GET', `/v1/status-pages/${encodeURIComponent(slug)}`);
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const token = this.config.apiKey ?? (await this.config.getAccessToken?.()) ?? null;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let code = 'unknown_error';
      let message = `HTTP ${res.status}`;
      try {
        const payload = (await res.json()) as { code?: string; message?: string };
        code = payload.code ?? code;
        message = payload.message ?? message;
      } catch {
        // non-JSON error body — keep defaults
      }
      throw new NsentryApiError(res.status, code, message);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
