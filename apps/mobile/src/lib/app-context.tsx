/**
 * Purpose: App-wide context — the active NsentryClient + auth session handle.
 * Inputs: value assembled in App.tsx from useAuth() + createApiClient().
 * Outputs: <AppContext.Provider>, useApp() hook.
 * Constraints: useApp() throws outside the provider (fail fast, typed non-null).
 */
import { createContext, useContext } from 'react';
import type { NsentryClient } from '@nself/nsentry-client';
import type { UseAuthResult } from '../hooks/useAuth';

export interface AppContextValue {
  api: NsentryClient;
  auth: UseAuthResult;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppContext.Provider>');
  return value;
}
