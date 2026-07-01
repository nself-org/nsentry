/**
 * Purpose: Shared navigation + app-level types for ɳSentry mobile.
 * Inputs: none — pure type declarations.
 * Outputs: RootStackParamList (native-stack), TabParamList (bottom-tabs).
 * Constraints: keep navigation params serializable.
 */

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  MonitorDetail: { monitorId: string; name: string };
  StatusPage: { slug: string; name: string };
};

export type TabParamList = {
  Monitors: undefined;
  Incidents: undefined;
  Status: undefined;
  Settings: undefined;
};
