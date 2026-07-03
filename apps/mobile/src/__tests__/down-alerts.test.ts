/**
 * Purpose: Down-alert plumbing tests — push payload → deep-link target
 *          extraction and the local-notification fallback (up→down edge,
 *          baseline seeding, suppression when server push is registered).
 * Inputs: mocked expo-notifications (__mocks__), renderHook.
 * Outputs: pass/fail; guards the payload contract shared with the gateway.
 */
import { renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import type { Monitor } from '@nself/nsentry-client';
import { monitorTargetFromData, notifyMonitorDownLocally } from '../lib/notifications';
import { useDownAlertFallback } from '../hooks/useDownAlertFallback';
import type { PushState } from '../hooks/usePushToken';

const mockNotifications = Notifications as unknown as {
  scheduleNotificationAsync: jest.Mock;
  __scheduled: Array<{ content: { title: string; data: Record<string, unknown> } }>;
  __reset: () => void;
};

const monitor = (id: string, status: Monitor['status']): Monitor => ({
  id,
  name: `mon-${id}`,
  url: `https://${id}.example.org`,
  kind: 'https',
  intervalSeconds: 60,
  status,
  paused: false,
  createdAt: '2026-07-03T00:00:00Z',
});

beforeEach(() => mockNotifications.__reset());

describe('monitorTargetFromData', () => {
  it('extracts the alert-router snake_case payload', () => {
    expect(
      monitorTargetFromData({ kind: 'monitor_down', monitor_id: 'm1', monitor_name: 'API' }),
    ).toEqual({ monitorId: 'm1', name: 'API' });
  });

  it('tolerates camelCase and missing name', () => {
    expect(monitorTargetFromData({ monitorId: 'm2' })).toEqual({ monitorId: 'm2' });
  });

  it('returns null for non-monitor payloads', () => {
    expect(monitorTargetFromData(null)).toBeNull();
    expect(monitorTargetFromData({ other: true })).toBeNull();
    expect(monitorTargetFromData({ monitor_id: 42 })).toBeNull();
  });
});

describe('notifyMonitorDownLocally', () => {
  it('schedules an immediate notification carrying the deep-link payload', async () => {
    await notifyMonitorDownLocally({ id: 'm1', name: 'API', url: 'https://api.example.org' });
    expect(mockNotifications.__scheduled).toHaveLength(1);
    const { content } = mockNotifications.__scheduled[0];
    expect(content.title).toContain('DOWN');
    expect(content.data).toMatchObject({ kind: 'monitor_down', monitor_id: 'm1' });
  });
});

describe('useDownAlertFallback', () => {
  const render = (initial: {
    monitors: Monitor[] | null;
    pushState: PushState;
    enabled: boolean;
  }) => renderHook((props) => useDownAlertFallback(props), { initialProps: initial });

  it('alerts on an up→down transition (and not on the seeding fetch)', () => {
    const { rerender } = render({
      monitors: [monitor('a', 'up')],
      pushState: 'coming_soon',
      enabled: true,
    });
    expect(mockNotifications.__scheduled).toHaveLength(0); // baseline seed — silent

    rerender({ monitors: [monitor('a', 'down')], pushState: 'coming_soon', enabled: true });
    expect(mockNotifications.__scheduled).toHaveLength(1);

    // Still down on the next refresh — no re-alert.
    rerender({ monitors: [monitor('a', 'down')], pushState: 'coming_soon', enabled: true });
    expect(mockNotifications.__scheduled).toHaveLength(1);
  });

  it('stays silent when server push is registered or fallback disabled (demo)', () => {
    const { rerender } = render({
      monitors: [monitor('a', 'up')],
      pushState: 'registered',
      enabled: true,
    });
    rerender({ monitors: [monitor('a', 'down')], pushState: 'registered', enabled: true });
    expect(mockNotifications.__scheduled).toHaveLength(0);

    const demo = render({ monitors: [monitor('b', 'up')], pushState: 'coming_soon', enabled: false });
    demo.rerender({ monitors: [monitor('b', 'down')], pushState: 'coming_soon', enabled: false });
    expect(mockNotifications.__scheduled).toHaveLength(0);
  });
});
