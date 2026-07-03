/**
 * Purpose: Notification plumbing for down alerts — foreground display
 *          behavior, push-payload → deep-link target extraction, and the
 *          local-notification fallback used while the gateway push route
 *          rolls out (see usePushToken TODO nsentry-push-backend).
 * Inputs: expo-notifications payloads. Down-alert data contract (shared with
 *   nself-alert-router, plan §W1/W7): { kind: 'monitor_down' | 'incident_open',
 *   monitor_id, monitor_name } — same payload whether the push comes from the
 *   gateway or the local fallback, so the tap handler has ONE code path.
 * Outputs: configureNotificationHandling / monitorTargetFromResponse /
 *   notifyMonitorDownLocally.
 * Constraints: pure data-mapping where possible (unit-tested); anything
 *   touching the native module is a thin wrapper. Never throws — alerts are
 *   best-effort, the app must not crash because notifications misbehave.
 */
import * as Notifications from 'expo-notifications';

/** Deep-link target for a tapped down alert. */
export interface MonitorTarget {
  monitorId: string;
  name?: string;
}

/**
 * Show down alerts even while the app is foregrounded (default is to
 * suppress). Called once at app module load.
 */
export function configureNotificationHandling(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true, // legacy field, still honored on SDK 52-
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Extract the monitor deep-link target from a tapped notification.
 * Tolerates both the alert-router payload ({monitor_id, monitor_name}) and
 * camelCase ({monitorId, name}) so local-fallback and future gateway pushes
 * both resolve. Returns null for notifications that aren't monitor alerts.
 */
export function monitorTargetFromData(data: unknown): MonitorTarget | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  const monitorId = d.monitor_id ?? d.monitorId;
  if (typeof monitorId !== 'string' || monitorId.length === 0) return null;
  const name = d.monitor_name ?? d.name;
  return { monitorId, ...(typeof name === 'string' ? { name } : {}) };
}

/** Same extraction from a full notification response (tap event). */
export function monitorTargetFromResponse(
  response: Notifications.NotificationResponse,
): MonitorTarget | null {
  return monitorTargetFromData(response.notification.request.content.data);
}

/**
 * Local-notification fallback: fired when the app itself observes a monitor
 * going down (list refresh) and server push is not registered. Foreground /
 * app-open only, by design — honest stopgap, not a background pager.
 * Payload matches the gateway push contract so the tap deep-links identically.
 */
export async function notifyMonitorDownLocally(monitor: {
  id: string;
  name: string;
  url: string;
}): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${monitor.name} is DOWN`,
        body: monitor.url,
        data: { kind: 'monitor_down', monitor_id: monitor.id, monitor_name: monitor.name },
        sound: true,
      },
      trigger: null, // deliver immediately
    });
  } catch {
    // Best-effort — never let a notification failure surface as an app error.
  }
}
