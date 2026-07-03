/**
 * @nself/nsentry-client — public API barrel.
 *
 * Purpose: Single import source for the typed ɳSentry REST API client,
 *          contract types, wire mappers, and the offline mock server.
 * Inputs:  None — pure re-exports.
 * Outputs: NsentryClient, NsentryApiError, isComingOnline, contract types,
 *          wire types + mappers (for tests/fixtures), mock factory.
 * Constraints: Zero runtime dependencies; RN/browser/Node safe.
 * SPORT: F13-CROSS-REPO-DEPS — @nself/nsentry-client (nsentry repo)
 */

export {
  NsentryClient,
  NsentryApiError,
  NSENTRY_SAAS_API_URL,
  isComingOnline,
} from './client';
export type { NsentryClientConfig, FetchFn } from './client';

export { createMockFetch, defaultFixtures, MOCK_LOGIN } from './mock';
export type { MockFixtures } from './mock';

export type {
  CreateMonitorInput,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  LoginSession,
  Monitor,
  MonitorCheck,
  MonitorStatus,
  Overview,
  PublicComponentStatus,
  PublicOverallStatus,
  PublicStatusComponent,
  PublicStatusPage,
  QuotaUsage,
  SessionInfo,
  StatusPage,
  TenantInfo,
  TenantTier,
  UpdateMonitorInput,
} from './types';

export {
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
  mapStatusPage,
  mapStatusPages,
  monitorKindFromUrl,
} from './wire';
export type {
  WireIncident,
  WireLogin,
  WireMe,
  WireMonitor,
  WireMonitorCheck,
  WireOverview,
  WirePublicStatusPage,
  WireQuota,
  WireSession,
  WireStatusPage,
} from './wire';
