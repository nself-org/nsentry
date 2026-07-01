# Architecture

## Repo layout

```
apps/mobile/       React Native + Expo app (React 19, TS strict)
packages/client/   @nself/nsentry-client — typed REST client + offline mock
backend/           Local-first dev backend (nself.yaml + seeds; compose is generated, gitignored)
```

## Data flow

```
apps/mobile ──► @nself/nsentry-client ──► api.sentry.nself.org (SaaS)
     │                                └─► https://your-host (self-hosted Sentry Bundle)
     │                                └─► in-memory mock (Demo mode / tests)
     └── auth: @nself/auth-core (shared nself auth, JWT + SecureStore)
```

- The REST contract (monitors / incidents / status-pages / API-key auth) is
  served by the Sentry Bundle plugins (`nself-uptime-monitor`, `nself-incident-mgmt`,
  `nself-status-page`, `nself-alert-router`, …) in both SaaS and self-host modes.
- Endpoint switching lives in `apps/mobile/src/lib/config.ts` — SaaS / custom URL / demo.
- Push alerts: `usePushToken` registers the Expo token with the backend
  (`/v1/push/register`); the alert-router backend route is still landing (see the
  TODO in the hook — the wiring is real, the server side is pending).

## Shared packages

`@nself/auth-core`, `@nself/sdk-core`, `@nself/errors` come from the private
`nself-org/packages` repo, linked as a pnpm workspace sibling (`../packages/@nself/*`).
CI checks it out and symlinks it — see `.github/workflows/ci.yml`.

## Status

Scaffold (v0.1.0): screens + client + demo mode + local backend config are real;
i18n, observability, and TV/desktop surfaces are not yet wired (tracked TODOs, not stubs).
