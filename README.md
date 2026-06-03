# FarmChain

A decentralised agricultural marketplace built on the **Stellar blockchain**. Farmers list produce directly, buyers place orders, and every payment is locked in a **Soroban smart contract escrow** — released only when delivery is confirmed.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
  - [Option A — Docker (Recommended)](#option-a--docker-recommended)
  - [Option B — Local Postgres](#option-b--local-postgres)
- [Smart Contracts](#smart-contracts)
- [API Reference](#api-reference)
- [Scripts](#scripts)
- [CI / GitHub Actions](#ci--github-actions)
- [Contributing](#contributing)

---

## Overview

| Role | What they do |
|---|---|
| **Farmer** | Register, list produce with images, mark orders shipped, get paid on delivery |
| **Buyer** | Browse marketplace, pay with XLM, confirm delivery to release escrow |
| **Admin** | Resolve disputes with a configurable basis-point split |

**Escrow flow:**
```
Buyer places order → XLM locked in Soroban escrow
Farmer marks shipped (submits delivery hash)
Buyer confirms delivery → XLM released to Farmer
             ↓ (if dispute raised)
Admin resolves with farmer_bps (0–10 000 basis points)
```

---

## Architecture

```
┌─────────────────┐     REST/JWT      ┌──────────────────┐     PostgreSQL
│  React Frontend │ ───────────────▶  │  Express Backend  │ ──────────────▶ DB
│  Vite + Zustand │                   │  Node.js + pg     │
└────────┬────────┘                   └──────────────────┘
         │  Stellar SDK / Freighter
         ▼
┌─────────────────────────────────────┐
│         Stellar Testnet             │
│  ┌──────────┐  ┌─────────────┐  ┌──────────┐
│  │ Registry │  │ Marketplace │  │  Escrow  │
│  │ Contract │  │  Contract   │  │ Contract │
│  └──────────┘  └─────────────┘  └──────────┘
└─────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Rust · Soroban SDK 22 · `wasm32-unknown-unknown` |
| Blockchain | Stellar Testnet · Stellar CLI v23 |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS v4 |
| State | Zustand · React Router v7 |
| Wallet | Freighter (`@stellar/freighter-api` v6) |
| Stellar SDK | `@stellar/stellar-sdk` v15 |
| Backend | Express v5 · TypeScript · `tsx` |
| Database | PostgreSQL 16 |
| Auth | JWT (`jsonwebtoken`) |
| Storage | Pinata IPFS (product images) |
| DevOps | Docker · Docker Compose · GitHub Actions |

---

## Project Structure

```
FarmChain/
├── contracts/                  # Soroban smart contracts (Rust)
│   ├── registry/               # User registration & roles
│   ├── marketplace/            # Product listings
│   ├── escrow/                 # Payment escrow & dispute resolution
│   └── Cargo.toml              # Workspace definition
│
├── backend/                    # Express REST API
│   ├── src/
│   │   ├── db/
│   │   │   ├── client.ts       # pg Pool
│   │   │   └── schema.sql      # DB schema (auto-applied by Docker)
│   │   ├── middleware/
│   │   │   └── auth.ts         # JWT middleware
│   │   └── routes/
│   │       ├── auth.ts         # /auth/register · /auth/login · /auth/me
│   │       ├── products.ts     # /products CRUD + Pinata upload
│   │       ├── orders.ts       # /orders lifecycle
│   │       └── users.ts        # /users profile
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   # React application
│   └── src/
│       ├── components/
│       │   ├── layout/Navbar.tsx
│       │   ├── marketplace/ProductCard.tsx
│       │   └── shared/         # StatusBadge · TxStatusToast · HeroIllustration
│       ├── hooks/              # useWallet · useProducts · useOrders
│       ├── lib/                # api.ts · soroban.ts · stellar.ts
│       ├── pages/              # Home · Auth · Marketplace · Dashboards · Orders
│       ├── store/walletStore.ts
│       └── types/index.ts
│
├── scripts/
│   ├── deploy.sh               # Build & deploy all contracts to testnet
│   └── fund-testnet.sh         # Friendbot fund helper
│
├── docs/
│   └── PLAN.md                 # Full project plan with Mermaid diagrams
│
├── docker-compose.yml          # Postgres (port 5440) + optional backend
├── Makefile                    # Developer shortcuts
└── .env.example                # Environment variable template
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 22 | [nodejs.org](https://nodejs.org) |
| Rust | stable | `curl https://sh.rustup.rs -sSf \| sh` |
| wasm32 target | — | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | v23 | `cargo install --locked stellar-cli` |
| Docker & Compose | v2+ | [docs.docker.com](https://docs.docker.com/get-docker) |
| Freighter wallet | latest | [freighter.app](https://freighter.app) (browser extension) |

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/ombima56/FarmChain.git
cd FarmChain

# 2. Copy env template and fill in values
cp .env.example .env
cp .env.example backend/.env   # backend reads from its own directory

# 3. Start Postgres via Docker
make db

# 4. Install and start backend
cd backend && npm install && npx tsx src/index.ts &

# 5. Install and start frontend
cd ../frontend && npm install && npm run dev
```

Open **http://localhost:5173** (or whichever port Vite picks), install Freighter, and click **Connect Wallet**.

---

## Environment Variables

Copy `.env.example` to both `.env` (project root) and `backend/.env`.

```env
# ── Stellar ───────────────────────────────────────────────
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
DEPLOYER_SECRET_KEY=S...          # Testnet secret key for contract deployment

# ── Contract IDs (fill after running scripts/deploy.sh) ───
REGISTRY_CONTRACT_ID=
MARKETPLACE_CONTRACT_ID=
ESCROW_CONTRACT_ID=

# ── Backend ───────────────────────────────────────────────
PORT=4000
# Docker Postgres (recommended):
DATABASE_URL=postgres://farmchain:farmchain_dev@localhost:5440/farmchain
# Local Postgres alternative:
# DATABASE_URL=postgres://farmchain:farmchain_dev@localhost:5432/farmchain
JWT_SECRET=change_me_in_production
FRONTEND_URL=http://localhost:5173

# ── Pinata IPFS (product images) ──────────────────────────
PINATA_API_KEY=
PINATA_SECRET_KEY=

# ── Frontend (Vite — must be prefixed VITE_) ──────────────
VITE_STELLAR_NETWORK=testnet
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_REGISTRY_CONTRACT_ID=
VITE_MARKETPLACE_CONTRACT_ID=
VITE_ESCROW_CONTRACT_ID=
VITE_BACKEND_URL=http://localhost:4000
```

---

## Running the Project

### Option A — Docker (Recommended)

Docker runs Postgres on **port 5440** to avoid conflicts with any local Postgres instance.

```bash
# Start Postgres only (run backend & frontend locally)
make db

# Start Postgres + Backend together
make up

# Stop all containers
make down

# Wipe database and start fresh
make db-reset

# Stream container logs
make logs
```

After `make db`, start the backend and frontend manually:

```bash
# Terminal 1 — backend
cd backend && npx tsx src/index.ts

# Terminal 2 — frontend
cd frontend && npm run dev
```

### Option B — Local Postgres

If you prefer a local Postgres installation:

```bash
# Creates the farmchain user/database and applies schema (requires sudo)
make db-local
```

Then update `DATABASE_URL` in `backend/.env` to use port `5432`:

```env
DATABASE_URL=postgres://farmchain:farmchain_dev@localhost:5432/farmchain
```

---

## Smart Contracts

Three Soroban contracts live in `contracts/`:

### Registry
Manages user registration with roles (`Farmer`, `Buyer`, `Admin`), IPFS metadata hash, and activation status.

```
init(admin)
register_user(address, role, metadata_hash)
get_user(address) → UserRecord
is_registered(address) → bool
update_metadata(address, hash)
deactivate_user(address)
```

### Marketplace
Product listings with auto-increment IDs, per-farmer product index.

```
init(admin)
list_product(farmer, price_xlm, quantity, metadata_hash) → product_id
update_product(product_id, price_xlm, quantity)
delist_product(product_id, farmer)
mark_sold(product_id)
get_product(product_id) → Product
get_farmer_products(farmer) → Vec<u64>
```

### Escrow
Funds locking, shipping proof, delivery confirmation, and dispute resolution.

```
init(admin, token)
create_order(order_id, product_id, farmer, buyer, amount)
mark_shipped(order_id, farmer, tracking_hash)
confirm_delivery(order_id, buyer)           → releases funds to farmer
raise_dispute(order_id, caller)
resolve_dispute(order_id, farmer_bps)       → 0–10000 basis points to farmer
get_order(order_id) → Order
```

### Build & Test

```bash
cd contracts

# Run all 14 tests
cargo test

# Build WASM binaries
stellar contract build
```

### Deploy to Testnet

```bash
# Fund your deployer account first
./scripts/fund-testnet.sh <YOUR_PUBLIC_KEY>

# Build and deploy all three contracts
DEPLOYER_SECRET_KEY=S... ./scripts/deploy.sh
```

Copy the output contract IDs into your `.env` files.

---

## API Reference

Base URL: `http://localhost:4000`

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/auth/register` | `{ publicKey, role, name }` | Register new user, returns JWT |
| `POST` | `/auth/login` | `{ publicKey }` | Login existing user, returns JWT |
| `GET` | `/auth/me` | — | Get current user (JWT required) |

### Products

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/products` | List active products (supports `?category=`, `?search=`) |
| `GET` | `/products/:id` | Get single product |
| `POST` | `/products` | Create product with image upload (Farmer · JWT) |
| `PATCH` | `/products/:id` | Update product (Farmer · JWT) |
| `DELETE` | `/products/:id` | Delist product (Farmer · JWT) |

### Orders

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/orders` | — | List user's orders (JWT) |
| `GET` | `/orders/:id` | — | Get single order |
| `POST` | `/orders` | `{ productId, amount }` | Create order (Buyer · JWT) |
| `PATCH` | `/orders/:id/fund` | `{ txHash }` | Link escrow tx hash |
| `PATCH` | `/orders/:id/ship` | `{ trackingHash }` | Mark shipped (Farmer) |
| `PATCH` | `/orders/:id/complete` | — | Confirm delivery (Buyer) |
| `PATCH` | `/orders/:id/dispute` | `{ reason }` | Raise dispute |
| `PATCH` | `/orders/:id/resolve` | `{ farmerBps }` | Resolve dispute (Admin) |

All protected routes require: `Authorization: Bearer <token>`

---

## Scripts

```bash
# Fund a testnet account via Friendbot
./scripts/fund-testnet.sh <PUBLIC_KEY>

# Build & deploy all contracts, prints contract IDs
DEPLOYER_SECRET_KEY=S... ./scripts/deploy.sh
```

---

## CI / GitHub Actions

`.github/workflows/contracts.yml` runs on every push or PR that touches `contracts/`:

1. Installs Rust stable + `wasm32-unknown-unknown` target
2. Runs `cargo test` (14 contract tests)
3. Runs `stellar contract build`

---

## Contributing

1. Fork the repo and create a feature branch from `develop`
2. Follow the commit convention: `feat|fix|chore|ci(scope): message`
3. Make sure `cargo test` passes before opening a PR
4. Run `npm run lint` in `frontend/` before opening a PR

---

**License:** MIT
