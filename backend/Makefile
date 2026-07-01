# =============================================================================
# ɳSentry Backend — Makefile
#
# nSelf-First: backend starts via the nself CLI, never docker compose directly.
#   make build — alias for `nself build` (generates docker-compose.yml — gitignored)
#   make up    — alias for `nself start` + idempotent dev seed
#   make down  — alias for `nself stop`
# =============================================================================

NSELF   = nself
COMPOSE = docker compose

POSTGRES_USER ?= postgres
POSTGRES_DB   ?= nsentry

.PHONY: build
build: ## Build the nSelf stack (generates docker-compose.yml + nginx + SSL)
	$(NSELF) build

.PHONY: up
up: ## Start the backend stack (nSelf-First; wraps `nself start`) + auto-seed dev
	$(NSELF) start
	@bash scripts/seed-dev.sh || echo "(seed skipped — run 'make seed' once services are healthy)"

.PHONY: down
down: ## Stop all services (wraps `nself stop`)
	$(NSELF) stop

.PHONY: restart
restart: down up ## Restart all services

.PHONY: logs
logs: ## View logs from all services
	$(COMPOSE) logs -f

.PHONY: status
status: ## Show service status
	$(COMPOSE) ps

.PHONY: seed
seed: ## Seed dev tenant + user (idempotent; requires running stack)
	bash scripts/seed-dev.sh

.PHONY: health
health: ## Check health of core services
	@echo "--- PostgreSQL ---"
	@$(COMPOSE) exec postgres pg_isready -U $(POSTGRES_USER) 2>/dev/null || echo "DOWN"
	@echo "--- Hasura ---"
	@curl -sf http://localhost:8080/healthz && echo " OK" || echo "DOWN"
	@echo "--- Auth ---"
	@curl -sf http://localhost:4000/healthz && echo " OK" || echo "DOWN"
	@echo "--- Uptime monitor plugin ---"
	@curl -sf http://localhost:3831/healthz && echo " OK" || echo "DOWN (pro plugin — license key set?)"

.PHONY: psql
psql: ## Connect to PostgreSQL shell
	$(COMPOSE) exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-14s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
