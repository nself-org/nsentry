/**
 * @nself/nsentry-client — API contract types.
 *
 * Purpose: Typed shapes for the ɳSentry REST API v1 (api.sentry.nself.org and
 *          self-hosted Sentry Bundle deployments — same contract, per the
 *          self-host-parity promise).
 * Inputs:  None — pure type declarations.
 * Outputs: Monitor / CheckResult / Incident / StatusPage / TenantInfo types.
 * Constraints:
 *   - Contract source of truth: nself/.claude/docs/nsentry-saas-plan.md §4
 *     (monitors / incidents / status-pages / API-key auth). Field names follow
 *     the Sentry Bundle plugin API (nself-uptime-monitor, nself-incident-mgmt,
 *     nself-status-page).
 *   - All timestamps are ISO-8601 strings (UTC).
 * SPORT: F13-CROSS-REPO-DEPS — @nself/nsentry-client (nsentry repo)
 */

/** Subscription tier of a tenant — mirrors the SaaS quota table. */
export type TenantTier = 'free' | 'bundle' | 'plus';

/** Health status of a monitor. */
export type MonitorStatus = 'up' | 'down' | 'degraded' | 'paused' | 'pending';

/** Incident lifecycle status (nself-incident-mgmt). */
export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';

/** Incident severity. */
export type IncidentSeverity = 'critical' | 'major' | 'minor' | 'info';

/** Status-page component health. */
export type ComponentStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';

/** HTTP methods supported by uptime checks. */
export type CheckMethod = 'GET' | 'HEAD' | 'POST';

/** An uptime monitor (nself-uptime-monitor). */
export interface Monitor {
  id: string;
  name: string;
  url: string;
  method: CheckMethod;
  /** Check interval in seconds — floor enforced per tier (300/60/30). */
  intervalSeconds: number;
  timeoutMs: number;
  status: MonitorStatus;
  /** Check regions, e.g. ["eu-central", "us-east"]. */
  regions: string[];
  lastCheckAt: string | null;
  /** Rolling uptime ratios, 0..1. */
  uptime24h: number | null;
  uptime30d: number | null;
  /** Median latency over the last 24h, milliseconds. */
  latencyP50Ms: number | null;
  createdAt: string;
}

/** Input to create a monitor. */
export interface CreateMonitorInput {
  name: string;
  url: string;
  method?: CheckMethod;
  intervalSeconds?: number;
  timeoutMs?: number;
  regions?: string[];
}

/** Partial update of a monitor. */
export type UpdateMonitorInput = Partial<CreateMonitorInput>;

/** A single check result for a monitor. */
export interface CheckResult {
  id: string;
  monitorId: string;
  region: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  checkedAt: string;
  error: string | null;
}

/** A timeline entry on an incident. */
export interface IncidentUpdate {
  id: string;
  status: IncidentStatus;
  message: string;
  createdAt: string;
}

/** An incident (nself-incident-mgmt). */
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
  updates: IncidentUpdate[];
}

/** A component shown on a status page. */
export interface StatusPageComponent {
  id: string;
  name: string;
  status: ComponentStatus;
}

/** A status page (nself-status-page). */
export interface StatusPage {
  id: string;
  /** URL slug — public page at sentry.nself.org/s/<slug> (SaaS) or /s/<slug> self-host. */
  slug: string;
  name: string;
  overallStatus: ComponentStatus;
  components: StatusPageComponent[];
  /** Uptime ratio 0..1 over the trailing 90 days, per the page's monitors. */
  uptime90d: number | null;
}

/** Tier quota snapshot returned by /v1/me. */
export interface TenantQuotas {
  monitors: number;
  minIntervalSeconds: number;
  statusPages: number;
  retentionDays: number;
  seats: number;
}

/** The authenticated tenant (from API key or JWT tenant claim). */
export interface TenantInfo {
  tenantId: string;
  name: string;
  tier: TenantTier;
  quotas: TenantQuotas;
}

/** Paginated list envelope. */
export interface Page<T> {
  items: T[];
  total: number;
}
