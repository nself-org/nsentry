# ɳSentry

Open-source (MIT) client apps for ɳSentry — uptime monitoring, status pages,
incidents, and alerting built on nSelf.

## Pages

- [Getting Started](Getting-Started) — run the app + local backend
- [Architecture](Architecture) — three-surface model, repo layout, data flow
- [API Client](API-Client) — `@nself/nsentry-client` usage and contract

## The three surfaces

| Surface | What |
|---|---|
| This repo (MIT) | Mobile app (React Native + Expo) + typed API client |
| sentry.nself.org | Hosted SaaS (free tier + paid plans) |
| Sentry Bundle | Self-host plugins for your own nSelf deploy ($0.99/mo · $9.99/yr, or ɳSelf+) |

The app works against either backend — self-host parity is a core promise.
