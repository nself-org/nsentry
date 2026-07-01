#!/usr/bin/env bash
# =============================================================================
# seed-dev.sh — idempotent dev seed for the ɳSentry local stack.
#
# Purpose: create the shared dev user (same convention as ntask backend seeds)
#          via the hasura-auth signup endpoint, so the mobile app can sign in
#          out of the box with dev@nself.local / devpassword123.
# Inputs:  SEED_DEV_EMAIL / SEED_DEV_PASSWORD / AUTH_PORT from .env.dev (or defaults).
# Outputs: dev user in auth.users. Exits 0 if the user already exists.
# Constraints: never runs against non-local hosts; requires the stack to be up.
#
# TODO(nsentry-seed-monitors): once the Sentry Bundle plugins expose a seed/
# import endpoint (`nself sentry seed` CLI gap — PCI: nsentry-dev-seed), also
# seed 2-3 demo monitors + a status page for the dev tenant. Until then the
# mobile app's Demo mode (mock client) provides seeded data without a backend.
# =============================================================================
set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env.dev"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

EMAIL="${SEED_DEV_EMAIL:-dev@nself.local}"
PASSWORD="${SEED_DEV_PASSWORD:-devpassword123}"
AUTH_URL="http://localhost:${AUTH_PORT:-4000}"

if ! curl -sf "${AUTH_URL}/healthz" >/dev/null 2>&1; then
  echo "[seed-dev] auth service not reachable at ${AUTH_URL} — is the stack up?"
  exit 1
fi

HTTP_CODE=$(curl -s -o /tmp/nsentry-seed-out.json -w '%{http_code}' \
  -X POST "${AUTH_URL}/signup/email-password" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

case "$HTTP_CODE" in
  200|201) echo "[seed-dev] created dev user ${EMAIL}" ;;
  409)     echo "[seed-dev] dev user ${EMAIL} already exists — OK" ;;
  *)
    # hasura-auth returns 400 with 'email-already-in-use' on some versions
    if grep -q 'already' /tmp/nsentry-seed-out.json 2>/dev/null; then
      echo "[seed-dev] dev user ${EMAIL} already exists — OK"
    else
      echo "[seed-dev] signup failed (HTTP ${HTTP_CODE}):"
      cat /tmp/nsentry-seed-out.json
      exit 1
    fi
    ;;
esac

echo "[seed-dev] done. Sign in with ${EMAIL} / ${PASSWORD}"
