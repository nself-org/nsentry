/**
 * Purpose: Verifies demo mode end-to-end at the client layer — createApiClient
 *          with mode 'demo' serves seeded mock data with no network, and
 *          mutations persist within a demo session.
 * Inputs: lib/api createApiClient + @nself/nsentry-client mock transport.
 * Outputs: jest assertions.
 */
import { createApiClient, resetDemoSession } from '../lib/api';

const demo = { mode: 'demo' as const, customUrl: null };

describe('demo mode (offline mock backend)', () => {
  beforeEach(() => resetDemoSession());

  it('serves seeded monitors without any network', async () => {
    const api = createApiClient(demo, null);
    const monitors = await api.listMonitors();
    expect(monitors.total).toBe(3);
    expect(monitors.items.map((m) => m.id)).toContain('mon_api');
  });

  it('persists mutations across client instances within a session', async () => {
    const api1 = createApiClient(demo, null);
    const open = await api1.listIncidents({ status: 'open' });
    await api1.acknowledgeIncident(open.items[0]!.id);

    const api2 = createApiClient(demo, null); // same session mock
    const stillOpen = await api2.listIncidents({ status: 'open' });
    expect(stillOpen.total).toBe(0);
  });

  it('resets state when the demo session is reset', async () => {
    const api1 = createApiClient(demo, null);
    const open = await api1.listIncidents({ status: 'open' });
    await api1.resolveIncident(open.items[0]!.id);

    resetDemoSession();
    const api2 = createApiClient(demo, null);
    const openAgain = await api2.listIncidents({ status: 'open' });
    expect(openAgain.total).toBe(1);
  });
});
