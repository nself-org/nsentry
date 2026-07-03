# ɳSentry

Open-source (MIT) client apps for **ɳSentry** — uptime monitoring, status pages, incidents,
error tracking, and alerting built on [nSelf](https://github.com/nself-org/cli).

This repo is the **app surface** of the ɳSentry three-surface model:

| Surface | What | Where |
|---|---|---|
| **This repo** (MIT, free forever) | ɳSentry mobile app (React Native + Expo) + typed API client | `nself-org/nsentry` |
| **Hosted SaaS** | ɳSentry at [sentry.nself.org](https://sentry.nself.org) — free tier + paid plans | web/nsentry |
| **Self-host bundle** | The Sentry Bundle plugins ($0.99/mo · $9.99/yr, or included in ɳSelf+) running on **your own** nSelf deploy | `nself license` |

The app works against **either** backend — point it at `api.sentry.nself.org` (SaaS)
or at your own self-hosted nSelf stack running the Sentry Bundle plugins. Same
features, same API. Self-host parity is a core promise: nothing in this repo is paywalled.

## What's here

```
apps/mobile/       ɳSentry mobile app — React Native + Expo (TypeScript strict)
packages/client/   @nself/nsentry-client — typed API client + offline mock server
backend/           Local-first dev backend (nself CLI config + seeds)
.github/wiki/      Docs
```

## Quickstart — mobile app only (no backend needed)

```bash
pnpm install          # from repo root (pnpm 10+, Node 20+)
cd apps/mobile
pnpm start            # Expo dev server — scan QR with Expo Go
```

On the login screen choose **Demo mode** to explore with seeded mock data
(no server), or sign in against `https://api.sentry.nself.org` or your own
self-hosted endpoint (Settings → API endpoint).

> Note: `@nself/*` shared packages live in the sibling repo `nself-org/packages`.
> Clone it next to this repo (`../packages`) before `pnpm install` — same layout CI uses.

## Quickstart — full local stack

Requires the [nself CLI](https://github.com/nself-org/cli) (`curl -fsSL https://raw.githubusercontent.com/nself-org/cli/main/.github/install.sh | bash`), Docker, and a Sentry Bundle license key for the pro plugins (`nself license`).

```bash
cd backend
cp .env.example .env.dev    # then edit secrets
nself build                 # generates docker-compose.yml (gitignored)
cd .. && make up            # nself start + dev seed
make health                 # verify Hasura / auth are up
```

Then point the mobile app at `http://localhost:8080` (Settings → Custom endpoint;
use your machine's LAN IP on a real device).

## Down alerts (push)

Signed in against a real backend, the app registers its Expo push token via
`POST /v1/push/register`. That gateway route is still rolling out — until it
lands the app shows "Push alerts coming soon" (Settings) and falls back to a
**local notification** when a refresh reveals a monitor went down. Tapping
either notification deep-links to the monitor (`nsentry://monitor/{id}`).

## Development

```bash
make mobile-ci-local   # lint + typecheck + test (same gate as CI)
make client-ci-local   # packages/client lint + typecheck + test
make mobile-export     # expo export bundle check

# Opt-in live-gateway smoke (creates a throwaway tenant on the SaaS):
cd packages/client && NSENTRY_LIVE_E2E=1 pnpm vitest run live-smoke
```

Store builds: see the [Store Readiness](../../wiki/Store-Readiness) wiki page
(EAS profiles in `apps/mobile/eas.json`; `eas init` still pending — honest TODO).

## Docs

- [Getting Started](../../wiki/Getting-Started)
- [Architecture](../../wiki/Architecture)
- [API Client](../../wiki/API-Client)

## License

MIT — see [LICENSE](LICENSE). The mobile app and API client are free forever.
Revenue comes only from the hosted SaaS and the self-host plugin bundle, never from this code.
