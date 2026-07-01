/**
 * @nself/nsentry-client — public API barrel.
 *
 * Purpose: Single import source for the typed ɳSentry REST API client,
 *          contract types, and the offline mock server.
 * Inputs:  None — pure re-exports.
 * Outputs: NsentryClient, NsentryApiError, contract types, mock factory.
 * Constraints: Zero runtime dependencies; RN/browser/Node safe.
 * SPORT: F13-CROSS-REPO-DEPS — @nself/nsentry-client (nsentry repo)
 */

export {
  NsentryClient,
  NsentryApiError,
  NSENTRY_SAAS_API_URL,
} from './client';
export type { NsentryClientConfig, FetchFn } from './client';

export { createMockFetch, defaultFixtures } from './mock';
export type { MockFixtures } from './mock';

export type {
  CheckMethod,
  CheckResult,
  ComponentStatus,
  CreateMonitorInput,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  IncidentUpdate,
  Monitor,
  MonitorStatus,
  Page,
  StatusPage,
  StatusPageComponent,
  TenantInfo,
  TenantQuotas,
  TenantTier,
  UpdateMonitorInput,
} from './types';
