# Store Readiness

Everything needed to cut a store build of the ɳSentry mobile app.

## Brand assets (checked in, `apps/mobile/assets/`)

| Asset | File | Size | Notes |
|---|---|---|---|
| App icon | `icon.png` | 1024×1024 | ɳ glyph in brand blue `#5B9DFF` + status dot, dark `#030712` |
| Android adaptive icon | `adaptive-icon.png` | 1024×1024 | Foreground layer, `#030712` background in `app.json` |
| Splash | `splash-icon.png` | 1024×1024 | Contain on `#030712` |
| Notification icon | `notification-icon.png` | 96×96 | Monochrome; tint `#5B9DFF` |
| Web favicon | `favicon.png` | 48×48 | Expo web only |

All referenced from `apps/mobile/app.json` (`icon`, `splash`, `android.adaptiveIcon`,
`web.favicon`, `expo-notifications` plugin).

## Identifiers

| Field | Value |
|---|---|
| iOS bundle identifier | `dev.nself.nsentry` |
| Android package | `dev.nself.nsentry` |
| Deep-link scheme | `nsentry://` (`monitor/{id}`, `status/{slug}`) |
| Version | `0.1.0` (`app.json`, no bumps without a release plan) |

## Building with EAS

Profiles live in `apps/mobile/eas.json` (development / preview / production).

```bash
cd apps/mobile
npx eas-cli login          # nself-org Expo account
npx eas-cli init           # one-time: replaces the placeholder extra.eas.projectId
npx eas-cli build --profile preview --platform ios      # simulator build
npx eas-cli build --profile production --platform all   # store builds
```

Honest status: `extra.eas.projectId` in `app.json` is a **placeholder** — no EAS
project has been created yet. `eas init` sets the real UUID; `submit.production.ios.ascAppId`
is a TODO until the App Store Connect app exists. Remote push tokens
(`getExpoPushTokenAsync`) also require the real EAS project id — until then the
app runs with the local down-alert fallback (see [Architecture](Architecture)).

## Screenshots

Capture in the iOS simulator / Android emulator using **Demo mode** (login screen →
"Try demo mode") — seeded mock data renders deterministic, presentable screens with
no server or account.

Required sets:

| Store | Sizes |
|---|---|
| App Store | 6.9" (iPhone 16 Pro Max), 6.5" (11 Pro Max), 12.9" iPad Pro |
| Play Store | Phone 16:9, 7" tablet, 10" tablet + 1024×500 feature graphic |

Shot list (one per tab, demo mode):

1. **Monitors** — status dots, mixed up/down list
2. **Monitor detail** — uptime, recent checks
3. **Incidents** — open incident with ack/resolve
4. **Status pages** — public page render
5. **Settings** — endpoint switcher (SaaS / self-host / demo) — the self-host-parity story

Store listing copy lives with the marketing site (`web/nsentry`), not this repo.
