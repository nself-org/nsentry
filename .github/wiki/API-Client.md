# API Client — @nself/nsentry-client

Typed, zero-dependency client for the ɳSentry REST API v1. Works in React
Native, browsers, and Node.

## Usage

```ts
import { NsentryClient } from '@nself/nsentry-client';

// Hosted SaaS with an API key (create one in the dashboard or `nself sentry` CLI)
const api = new NsentryClient({ apiKey: 'nsk_...' });

// Self-hosted deploy with a user JWT (e.g. from @nself/auth-core)
const api = new NsentryClient({
  baseUrl: 'https://sentry.your-domain.org',
  getAccessToken: async () => strategy.getAccessToken(),
});

const { items } = await api.listMonitors({ status: 'down' });
await api.acknowledgeIncident(items[0].id);
```

## Offline mock

```ts
import { NsentryClient } from '@nself/nsentry-client';
import { createMockFetch } from '@nself/nsentry-client/mock';

const api = new NsentryClient({ fetchFn: createMockFetch() });
```

The mock implements every route with seeded in-memory fixtures — it backs the
app's Demo mode and the test suite.

## Surface

| Area | Methods |
|---|---|
| Tenant | `me()` |
| Monitors | `listMonitors` · `getMonitor` · `createMonitor` · `updateMonitor` · `deleteMonitor` · `pauseMonitor` · `resumeMonitor` · `listChecks` |
| Incidents | `listIncidents` · `getIncident` · `acknowledgeIncident` · `resolveIncident` |
| Status pages | `listStatusPages` · `getStatusPage` |

Errors surface as `NsentryApiError { status, code, message }`; quota limits
return `402 quota_exceeded` per the tier table in the ɳSentry plan.
