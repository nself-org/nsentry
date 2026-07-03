/**
 * @nself/nsentry-client — wire ↔ view-model mapping for the ɳSentry gateway.
 *
 * Purpose: The gateway (api.sentry.nself.org, and the same Sentry Bundle
 *          gateway on a self-hosted deploy) speaks the documented /v1
 *          contract: enveloped snake_case ({"monitors":[...]}, fields like
 *          interval_seconds, created_at). This module converts those wire
 *          payloads into the camelCase view models in types.ts. Pure
 *          functions, no fetch — unit-testable against captured gateway
 *          fixtures. Mirrors web/nsentry/src/lib/saas-mapping.ts (the SPA's
 *          verified-live mapping) 1:1 for the shared shapes.
 * Inputs:  Parsed JSON envelopes from client.ts requests.
 * Outputs: Monitor / Incident / StatusPage / PublicStatusPage / TenantInfo /
 *          LoginSession / Overview.
 * Constraints: Tolerant of missing optional fields (older gateway builds);
 *          never throws on absent envelope keys — returns safe defaults.
 * SPORT: F13-CROSS-REPO-DEPS — @nself/nsentry-client (nsentry repo)
 */

import type {
  Incident,
  LoginSession,
  Monitor,
  MonitorCheck,
  Overview,
  PublicComponentStatus,
  PublicOverallStatus,
  PublicStatusPage,
  QuotaUsage,
  SessionInfo,
  StatusPage,
  TenantInfo,
  TenantTier,
} from './types';

// ─── Wire shapes (gateway contract, snake_case) ──────────────────────────────

export interface WireMonitor {
  id: string;
  name: string;
  url: string;
  kind: string;
  interval_seconds: number;
  status: 'up' | 'down' | 'paused' | 'pending';
  paused: boolean;
  created_at: string;
}

export interface WireMonitorCheck {
  checked_at: string;
  status: 'up' | 'down';
  latency_ms: number | null;
}

export interface WireIncident {
  id: string;
  monitor_id: string;
  title: string;
  status: 'open' | 'acknowledged' | 'resolved';
  severity: string;
  started_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface WireStatusPage {
  id: string;
  name: string;
  slug: string;
  url: string;
  public: boolean;
  created_at: string;
}

export interface WirePublicStatusComponent {
  id: string;
  name: string;
  status: string;
  uptime_percent: number | null;
}

export interface WirePublicStatusPage {
  title: string;
  slug: string;
  overall_status: string;
  components?: WirePublicStatusComponent[];
  incidents?: Array<{ title: string; status: string; started_at: string; resolved_at?: string }>;
  generated_at?: string;
}

export interface WireQuota {
  used: number;
  limit: number;
}

export interface WireMe {
  tenant_id: string;
  email: string;
  tier: string;
  quotas?: Record<string, WireQuota>;
}

export interface WireLogin {
  token: string;
  tenant_id: string;
  email: string;
  tier: string;
  name: string;
  expires_in: number;
}

export interface WireSession {
  authenticated: boolean;
  tenant_id: string;
  email: string;
  tier: string;
  name: string;
}

export interface WireOverview {
  monitors?: { total: number; up: number; down: number; paused: number; pending: number };
  incidents?: { open: number };
  uptime_percent_24h?: number | null;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

const KNOWN_SEVERITIES = new Set(['critical', 'major', 'minor', 'info']);
const KNOWN_TIERS = new Set(['free', 'bundle', 'plus']);
const PUBLIC_COMPONENT_STATUSES = new Set(['operational', 'degraded', 'down', 'unknown']);
const PUBLIC_OVERALL_STATUSES = new Set(['operational', 'degraded', 'down']);

const tier = (t: string | undefined): TenantTier =>
  (KNOWN_TIERS.has(t ?? '') ? t : 'free') as TenantTier;

export function mapMonitor(w: WireMonitor): Monitor {
  return {
    id: w.id,
    name: w.name,
    url: w.url,
    kind: w.kind,
    intervalSeconds: w.interval_seconds,
    status: w.status,
    paused: w.paused,
    createdAt: w.created_at,
  };
}

export function mapMonitors(body: { monitors?: WireMonitor[] }): Monitor[] {
  return (body.monitors ?? []).map(mapMonitor);
}

export function mapMonitorChecks(body: { checks?: WireMonitorCheck[] }): MonitorCheck[] {
  return (body.checks ?? []).map((c) => ({
    checkedAt: c.checked_at,
    status: c.status,
    latencyMs: c.latency_ms ?? null,
  }));
}

export function mapIncident(w: WireIncident): Incident {
  return {
    id: w.id,
    monitorId: w.monitor_id || null,
    title: w.title,
    status: w.status,
    severity: (KNOWN_SEVERITIES.has(w.severity) ? w.severity : 'minor') as Incident['severity'],
    startedAt: w.started_at,
    acknowledgedAt: w.acknowledged_at ?? null,
    resolvedAt: w.resolved_at ?? null,
  };
}

export function mapIncidents(body: { incidents?: WireIncident[] }): Incident[] {
  return (body.incidents ?? []).map(mapIncident);
}

export function mapStatusPage(w: WireStatusPage): StatusPage {
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    url: w.url,
    public: w.public,
    createdAt: w.created_at,
  };
}

export function mapStatusPages(body: { status_pages?: WireStatusPage[] }): StatusPage[] {
  return (body.status_pages ?? []).map(mapStatusPage);
}

/** Map the public status-page wire envelope ({"status_page":{...}}). */
export function mapPublicStatusPage(body: { status_page?: WirePublicStatusPage }): PublicStatusPage {
  const p = body.status_page;
  return {
    title: p?.title ?? '',
    slug: p?.slug ?? '',
    overallStatus: (PUBLIC_OVERALL_STATUSES.has(p?.overall_status ?? '')
      ? p?.overall_status
      : 'operational') as PublicOverallStatus,
    components: (p?.components ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      status: (PUBLIC_COMPONENT_STATUSES.has(c.status) ? c.status : 'unknown') as PublicComponentStatus,
      uptimePercent: c.uptime_percent ?? null,
    })),
    incidents: (p?.incidents ?? []).map((i) => ({
      title: i.title,
      status: i.status,
      startedAt: i.started_at,
    })),
    generatedAt: p?.generated_at,
  };
}

export function mapMe(w: WireMe): TenantInfo {
  const quotas: Record<string, QuotaUsage> = {};
  for (const [dim, q] of Object.entries(w.quotas ?? {})) {
    quotas[dim] = { used: q.used, limit: q.limit };
  }
  return { tenantId: w.tenant_id, email: w.email, tier: tier(w.tier), quotas };
}

export function mapLogin(w: WireLogin): LoginSession {
  return {
    token: w.token,
    tenantId: w.tenant_id,
    email: w.email,
    tier: tier(w.tier),
    name: w.name,
    expiresIn: w.expires_in,
  };
}

export function mapSession(w: WireSession): SessionInfo {
  return {
    authenticated: w.authenticated,
    tenantId: w.tenant_id,
    email: w.email,
    tier: tier(w.tier),
    name: w.name,
  };
}

export function mapOverview(body: { overview?: WireOverview }): Overview {
  const o = body.overview;
  return {
    monitors: {
      total: o?.monitors?.total ?? 0,
      up: o?.monitors?.up ?? 0,
      down: o?.monitors?.down ?? 0,
      paused: o?.monitors?.paused ?? 0,
      pending: o?.monitors?.pending ?? 0,
    },
    incidentsOpen: o?.incidents?.open ?? 0,
    uptimePct24h: o?.uptime_percent_24h ?? null,
  };
}

/** Derive the gateway's monitor `kind` from a URL (https default). */
export function monitorKindFromUrl(url: string): string {
  return url.startsWith('http://') ? 'http' : 'https';
}
