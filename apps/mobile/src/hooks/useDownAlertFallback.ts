/**
 * Purpose: Local down-alert fallback — watches the fetched monitor list and
 *          fires a local notification when a monitor transitions up→down,
 *          but ONLY while server push is not registered (gateway route
 *          pending — usePushToken TODO nsentry-push-backend) and not in demo.
 * Inputs: { monitors, pushState, enabled } from the Monitors screen.
 * Outputs: side-effect local notifications (payload = gateway push contract,
 *          so taps deep-link through the same handler).
 * Constraints: transition-edge only (no re-alert while a monitor stays down);
 *   first fetch seeds the baseline silently (no alert storm on app open).
 */
import { useEffect, useRef } from 'react';
import type { Monitor } from '@nself/nsentry-client';
import type { PushState } from './usePushToken';
import { notifyMonitorDownLocally } from '../lib/notifications';

export interface DownAlertFallbackOptions {
  monitors: Monitor[] | null;
  pushState: PushState;
  /** False in demo mode — demo data must never page the user. */
  enabled: boolean;
}

export function useDownAlertFallback({ monitors, pushState, enabled }: DownAlertFallbackOptions): void {
  const lastStatuses = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!monitors) return;

    const previous = lastStatuses.current;
    const next = new Map(monitors.map((m) => [m.id, m.status]));
    lastStatuses.current = next;

    // First fetch seeds the baseline — alert only on observed transitions.
    if (!previous) return;
    if (!enabled || pushState === 'registered') return; // server push covers it

    for (const monitor of monitors) {
      const was = previous.get(monitor.id);
      if (monitor.status === 'down' && was !== undefined && was !== 'down') {
        void notifyMonitorDownLocally(monitor);
      }
    }
  }, [monitors, pushState, enabled]);
}
