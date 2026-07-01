# Getting Started

## Prerequisites

- Node 20+, pnpm 10+
- Expo Go on your phone (or an iOS/Android simulator)
- For the local backend: Docker + the [nself CLI](https://github.com/nself-org/cli)
- The sibling `nself-org/packages` repo cloned next to this repo (`../packages`)

## App only (fastest)

```bash
pnpm install
cd apps/mobile && pnpm start
```

Choose **Demo mode** on the login screen — seeded mock data, no server.

## Full local stack

```bash
cd backend
cp .env.example .env.dev        # edit secrets; set NSELF_PLUGIN_LICENSE_KEY for pro plugins
nself build
cd .. && make up                # nself start + dev seed (dev@nself.local / devpassword123)
make health
```

Point the app at your machine (Settings → Custom endpoint → `http://<lan-ip>:8080`).

## Local CI gate

```bash
make ci-local        # client + mobile: lint + typecheck + test
make mobile-export   # verify the Expo JS bundle builds
```
