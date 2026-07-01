# =============================================================================
# ɳSentry repo-level Makefile
#
# Thin wrapper over backend/Makefile + apps/mobile (React Native/Expo)
# + packages/client (@nself/nsentry-client).
#
# nSelf-First: `make up` delegates to `nself start` via backend/Makefile.
# Run `make build` once before first `make up` (generates docker-compose.yml).
# =============================================================================

BACKEND     := backend
APP_MOBILE  := apps/mobile
PKG_CLIENT  := packages/client

# ---------------------------------------------------------------------------
# Backend — nSelf-First
# ---------------------------------------------------------------------------

.PHONY: build
build: ## Build the nSelf backend stack (run once before first `make up`)
	$(MAKE) -C $(BACKEND) build

.PHONY: up
up: ## Start the backend stack via nself start (nSelf-First)
	$(MAKE) -C $(BACKEND) up

.PHONY: down
down: ## Stop the backend stack via nself stop
	$(MAKE) -C $(BACKEND) down

.PHONY: restart
restart: ## Restart the backend stack
	$(MAKE) -C $(BACKEND) restart

.PHONY: logs
logs: ## Tail backend logs
	$(MAKE) -C $(BACKEND) logs

.PHONY: status
status: ## Show backend service status
	$(MAKE) -C $(BACKEND) status

.PHONY: health
health: ## Run backend health checks (Hasura, Auth)
	$(MAKE) -C $(BACKEND) health

.PHONY: seed
seed: ## Seed the dev tenant + user (idempotent)
	$(MAKE) -C $(BACKEND) seed

# ---------------------------------------------------------------------------
# Mobile — React Native / Expo (apps/mobile)
# ---------------------------------------------------------------------------

.PHONY: mobile-install
mobile-install: ## Install workspace dependencies (pnpm install at root)
	pnpm install

.PHONY: mobile-start
mobile-start: ## Start Expo dev server (scan QR with Expo Go)
	cd $(APP_MOBILE) && pnpm start

.PHONY: mobile-ios
mobile-ios: ## Run mobile app on iOS simulator
	cd $(APP_MOBILE) && pnpm ios

.PHONY: mobile-android
mobile-android: ## Run mobile app on Android emulator
	cd $(APP_MOBILE) && pnpm android

.PHONY: mobile-ci-local
mobile-ci-local: ## Run the same gate CI runs for apps/mobile (lint + typecheck + test)
	@echo "==> [mobile-ci-local] lint"
	cd $(APP_MOBILE) && pnpm lint
	@echo "==> [mobile-ci-local] typecheck"
	cd $(APP_MOBILE) && pnpm typecheck
	@echo "==> [mobile-ci-local] test"
	cd $(APP_MOBILE) && pnpm test
	@echo "==> [mobile-ci-local] DONE"

.PHONY: mobile-export
mobile-export: ## Verify the Expo JS bundle builds (same check as CI)
	cd $(APP_MOBILE) && pnpm export:check

# ---------------------------------------------------------------------------
# API client — packages/client
# ---------------------------------------------------------------------------

.PHONY: client-ci-local
client-ci-local: ## Run the same gate CI runs for packages/client (lint + typecheck + test)
	@echo "==> [client-ci-local] lint"
	cd $(PKG_CLIENT) && pnpm lint
	@echo "==> [client-ci-local] typecheck"
	cd $(PKG_CLIENT) && pnpm typecheck
	@echo "==> [client-ci-local] test"
	cd $(PKG_CLIENT) && pnpm test
	@echo "==> [client-ci-local] DONE"

# ---------------------------------------------------------------------------
# Combined gates / bootstrap
# ---------------------------------------------------------------------------

.PHONY: ci-local
ci-local: client-ci-local mobile-ci-local ## Full local CI gate (client + mobile)

.PHONY: bootstrap
bootstrap: ## One-command local dev setup: backend + workspace install (idempotent)
	$(MAKE) -C $(BACKEND) build
	pnpm install
	@echo ""
	@echo "Bootstrap complete!"
	@echo "  Backend:  make up   (then make health / make seed)"
	@echo "  Hasura:   http://localhost:8080"
	@echo "  Mobile:   make mobile-start"

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
