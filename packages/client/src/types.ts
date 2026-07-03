/**
 * @nself/nsentry-client — API contract types (view models).
 *
 * Purpose: Typed shapes the app consumes. The live gateway
 *          (api.sentry.nself.org and self-hosted Sentry Bundle deployments —
 *          same contract per the self-host-parity promise) speaks enveloped
 *          snake_case JSON; wire.ts converts wire payloads into these
 *          camelCase view models.
 * Inputs:  None — pure type declarations.
 * Outputs: Monitor / MonitorCheck / Incident / StatusPage / PublicStatusPage /
 *          TenantInfo / LoginSession / Overview types.
 * Constraints:
 *   - Contract source of truth: plugins-pro/paid/nself-saas-gateway handlers_*
 *     (the same wire contract the web SPA's saas-mapping.ts consumes).
 *   - All timestamps are ISO-8601 strings (UTC).
 * SPORT: F13-CROSS-REPO-DEPS — @nself/nsentry-client (nsentry repo)
 */

/** Subscription tier of a tenant — mirrors the SaaS quota table. */
export type TenantTier = 'free' | 'bundle' | 'plus';

/** Health status of a monitor (gateway wire values). */
export type MonitorStatus = 'up' | 'down' | 'paused' | 'pending';

/** Incident lifecycle status (gateway folds "mitigating" into "acknowledged"). */
export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';

/** Incident severity. Unknown wire values normalize to 'minor'. */
export type IncidentSeverity = 'critical' | 'major' | 'minor' | 'info';

/** Public status-page component health. */
export type PublicComponentStatus = 'operational' | 'degraded' | 'down' | 'unknown';

/** Public status-page overall health. */
export type PublicOverallStatus = 'operational' | 'degraded' | 'down';

/** An uptime monitor (GET /v1/monitors). */
export interface Monitor {
  id: string;
  name: string;
  url: string;
  /** Probe kind, e.g. "https" | "http" (gateway `kind`). */
  kind: string;
  intervalSeconds: number;
  status: MonitorStatus;
  paused: boolean;
  createdAt: string;
}

/** Input to create a monitor (POST /v1/monitors). */
export interface CreateMonitorInput {
  name: string;
  url: string;
  /** Defaults to "https"/"http" derived from the URL when omitted. */
  kind?: string;
  intervalSeconds?: number;
}

/** Partial update of a monitor (PATCH /v1/monitors/{id}). */
export interface UpdateMonitorInput {
  name?: string;
  url?: string;
  intervalSeconds?: number;
  paused?: boolean;
}

/** A probe result (GET /v1/monitors/{id}/checks — rolling out on the SaaS). */
export interface MonitorCheck {
  checkedAt: string;
  status: 'up' | 'down';
  latencyMs: number | null;
}

/** An incident (GET /v1/incidents). */
export interface Incident {
  id: string;
  /** Linked monitor, when the incident was auto-opened by a failed check. */
  monitorId: string | null;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  startedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

/** A status-page registry entry (GET /v1/status-pages). */
export interface StatusPage {
  id: string;
  name: string;
  /** Public page at /v1/status/public/{slug} + status.<domain>/s/{slug}. */
  slug: string;
  /** Public URL of the rendered page. */
  url: string;
  public: boolean;
  createdAt: string;
}

/** A component on the PUBLIC status page (unauthenticated view). */
export interface PublicStatusComponent {
  id: string;
  name: string;
  status: PublicComponentStatus;
  /** Recent uptime %, null before any probe has completed. */
  uptimePercent: number | null;
}

/** The public status page (GET /v1/status/public/{slug} — unauthenticated). */
export interface PublicStatusPage {
  title: string;
  slug: string;
  overallStatus: PublicOverallStatus;
  components: PublicStatusComponent[];
  incidents: Array<{ title: string; status: string; startedAt: string }>;
  generatedAt?: string;
}

/** Quota usage for one dimension (used/limit). */
export interface QuotaUsage {
  used: number;
  limit: number;
}

/** The authenticated tenant (GET /v1/me). Quota dims include "monitors",
 *  "status_pages", "error_events_month", "rum_pageviews_month", "heartbeats". */
export interface TenantInfo {
  tenantId: string;
  email: string;
  tier: TenantTier;
  quotas: Record<string, QuotaUsage>;
}

/** Session issued by POST /v1/login (email/password → 7-day HS256 JWT). */
export interface LoginSession {
  token: string;
  tenantId: string;
  email: string;
  tier: TenantTier;
  name: string;
  /** Seconds until the token expires. */
  expiresIn: number;
}

/** Verified identity echo (GET /v1/session with Bearer token). */
export interface SessionInfo {
  authenticated: boolean;
  tenantId: string;
  email: string;
  tier: TenantTier;
  name: string;
}

/** Tenant dashboard overview (GET /v1/overview). */
export interface Overview {
  monitors: { total: number; up: number; down: number; paused: number; pending: number };
  incidentsOpen: number;
  /** Recent uptime percentage; null before any probe has run. */
  uptimePct24h: number | null;
}
