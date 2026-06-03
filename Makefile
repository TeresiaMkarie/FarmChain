.PHONY: db db-local up down logs db-reset

# ── Docker options ────────────────────────────────────────────────────────────

## Start only Postgres in Docker (run backend & frontend locally)
db:
	docker compose up postgres -d
	@echo ""
	@echo "Postgres is up → postgres://farmchain:farmchain_dev@localhost:5440/farmchain"
	@echo "Run 'make logs' to watch logs, 'make down' to stop."

## Start Postgres + Backend in Docker (run frontend locally)
up:
	docker compose --profile backend up -d
	@echo ""
	@echo "Postgres + Backend running."
	@echo "  API  → http://localhost:4000"
	@echo "  DB   → postgres://farmchain:farmchain_dev@localhost:5432/farmchain"

## Stop all Docker services
down:
	docker compose --profile backend down

## Stream Docker logs
logs:
	docker compose --profile backend logs -f

## Wipe database volume and recreate (WARNING: deletes all data)
db-reset:
	docker compose down -v
	docker compose up postgres -d
	@echo "Database reset. Schema will be applied on first start."

# ── Local Postgres option ─────────────────────────────────────────────────────

## Set up local Postgres (run once — requires sudo)
db-local:
	@echo "Creating local Postgres user and database..."
	sudo -u postgres psql -c "CREATE USER farmchain WITH PASSWORD 'farmchain_dev';" 2>/dev/null || true
	sudo -u postgres psql -c "CREATE DATABASE farmchain OWNER farmchain;" 2>/dev/null || true
	sudo -u postgres psql -d farmchain -c "GRANT ALL PRIVILEGES ON SCHEMA public TO farmchain;"
	psql "postgres://farmchain:farmchain_dev@localhost:5432/farmchain" \
	  -f backend/src/db/schema.sql
	@echo ""
	@echo "Local Postgres ready → postgres://farmchain:farmchain_dev@localhost:5432/farmchain"

# ── Dev shortcuts ─────────────────────────────────────────────────────────────

## Start backend dev server locally
dev-backend:
	cd backend && npx tsx src/index.ts

## Start frontend dev server
dev-frontend:
	cd frontend && npm run dev
