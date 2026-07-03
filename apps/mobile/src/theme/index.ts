/**
 * Purpose: ɳSentry mobile theme — dark-first palette + spacing + status colors.
 * Inputs: none.
 * Outputs: colors, spacing, statusColor() helper.
 * Constraints: dark-first per nSelf brand; status colors meet WCAG AA on bg.
 */
import type { IncidentSeverity, MonitorStatus, PublicComponentStatus } from '@nself/nsentry-client';

export const colors = {
  bg: '#030712',
  surface: '#111827',
  surfaceAlt: '#1F2937',
  border: '#374151',
  text: '#F9FAFB',
  textMuted: '#9CA3AF',
  /** nSelf brand blue — matches the app icon/splash mark. */
  primary: '#5B9DFF',
  up: '#34D399',
  down: '#F87171',
  degraded: '#FBBF24',
  paused: '#9CA3AF',
  pending: '#60A5FA',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Color for a monitor status dot/badge. */
export function monitorStatusColor(status: MonitorStatus): string {
  switch (status) {
    case 'up':
      return colors.up;
    case 'down':
      return colors.down;
    case 'paused':
      return colors.paused;
    case 'pending':
      return colors.pending;
  }
}

/** Color for a public status-page component/overall status. */
export function componentStatusColor(status: PublicComponentStatus): string {
  switch (status) {
    case 'operational':
      return colors.up;
    case 'degraded':
      return colors.degraded;
    case 'down':
      return colors.down;
    case 'unknown':
      return colors.paused;
  }
}

/** Color for incident severity. */
export function severityColor(severity: IncidentSeverity): string {
  switch (severity) {
    case 'critical':
      return colors.down;
    case 'major':
      return colors.degraded;
    case 'minor':
      return colors.pending;
    case 'info':
      return colors.paused;
  }
}
