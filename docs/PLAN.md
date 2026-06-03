# FarmChain - Development Plan

> Stellar-Powered Farmers Marketplace
> Stack: Rust / Soroban / React / TypeScript
> Network: Stellar Testnet to Mainnet

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack and Tooling](#2-tech-stack-and-tooling)
3. [Access and Credentials Required](#3-access-and-credentials-required)
4. [System Architecture](#4-system-architecture)
5. [Data Flow - Full System](#5-data-flow---full-system)
6. [Flow 1 - User Registration and Verification](#6-flow-1---user-registration-and-verification)
7. [Flow 2 - Product Listing](#7-flow-2---product-listing)
8. [Flow 3 - Order Placement and Escrow Lock](#8-flow-3---order-placement-and-escrow-lock)
9. [Flow 4 - Delivery and Payment Release](#9-flow-4---delivery-and-payment-release)
10. [Flow 5 - Dispute Resolution](#10-flow-5---dispute-resolution)
11. [Order State Machine](#11-order-state-machine)
12. [Smart Contract Design](#12-smart-contract-design)
13. [Frontend Architecture](#13-frontend-architecture)
14. [Backend API Design](#14-backend-api-design)
15. [Project Directory Structure](#15-project-directory-structure)
16. [Development Phases](#16-development-phases)
17. [Environment Setup](#17-environment-setup)

---

## 1. Project Overview

FarmChain eliminates middlemen from agricultural trade by connecting farmers directly to
buyers (wholesalers, retailers, restaurants, exporters, cooperatives) on the Stellar
blockchain. Every payment is locked in a Soroban escrow smart contract and released
only after the buyer confirms delivery.

**Core value loop:**

```
Farmer lists produce -> Buyer orders -> Funds locked on-chain
-> Farmer ships -> Buyer confirms -> Funds released to farmer
```

---

## 2. Tech Stack and Tooling

| Layer | Technology | Purpose |
|---|---|---|
| Smart Contracts | Rust + Soroban SDK | Escrow, marketplace logic, user registry |
| Blockchain | Stellar Network | Payments, ledger, token settlement |
| Frontend | React 18 + TypeScript | Farmer and buyer web app |
| Wallet | Freighter Browser Extension | Stellar key management and tx signing |
| Stellar SDK | @stellar/stellar-sdk | Frontend to Stellar network bridge |
| Soroban RPC | soroban-client | Frontend to Soroban contract calls |
| Styling | Tailwind CSS | Utility-first responsive UI |
| State | Zustand | Lightweight global store |
| Forms | React Hook Form + Zod | Typed form validation |
| Routing | React Router v6 | SPA navigation |
| Backend | Node.js + TypeScript Express | Off-chain metadata, IPFS pin, notifications |
| Database | PostgreSQL | User profiles, product metadata, order state |
| File Storage | IPFS via Pinata | Product images, receipts |
| Testing Contracts | soroban-sdk test harness | Unit tests for smart contracts |
| Testing Frontend | Vitest + Testing Library | Component and integration tests |
| CI/CD | GitHub Actions | Build, test, deploy pipeline |
| Contract Deploy | Soroban CLI | Deploy and invoke contracts |
| Dev Environment | Docker Compose | Local Stellar + PostgreSQL stack |

---

## 3. Access and Credentials Required

| Resource | What You Need | Where to Get It |
|---|---|---|
| Stellar Testnet | Freighter wallet + testnet XLM | friendbot.stellar.org faucet |
| Stellar Mainnet | Funded Stellar account XLM | Exchange or on-ramp |
| Soroban CLI | soroban binary | cargo install soroban-cli |
| Freighter Extension | Browser wallet | freighter.app |
| Pinata IPFS | API Key + Secret | pinata.cloud free tier |
| PostgreSQL | DB credentials | Local Docker or Supabase or Neon |
| GitHub | Repo + Actions secrets | github.com |
| Docker | Docker Desktop or Engine | docker.com |
| Node.js | v20 LTS | nodejs.org |
| Rust | Stable toolchain + wasm32 target | rustup |

**Required env vars (.env):**

```env
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
DEPLOYER_SECRET_KEY=S...

ESCROW_CONTRACT_ID=
MARKETPLACE_CONTRACT_ID=
REGISTRY_CONTRACT_ID=

DATABASE_URL=postgres://user:pass@localhost:5432/farmchain
PINATA_API_KEY=
PINATA_SECRET_KEY=
JWT_SECRET=

VITE_STELLAR_NETWORK=testnet
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_ESCROW_CONTRACT_ID=
VITE_MARKETPLACE_CONTRACT_ID=
VITE_REGISTRY_CONTRACT_ID=
VITE_BACKEND_URL=http://localhost:4000
```

---

## 4. System Architecture

```mermaid
graph TB
    F[Farmer] --> UI[React Web App]
    B[Buyer] --> UI
    A[Admin] --> UI

    UI --> FW[Freighter Wallet]
    UI --> API[Backend REST API]

    FW --> REG[Registry Contract]
    FW --> MKT[Marketplace Contract]
    FW --> ESC[Escrow Contract]

    API --> DB[PostgreSQL]
    API --> IPFS[IPFS Pinata]
    API --> NOTIF[Notifications]

    REG --> MKT
    MKT --> ESC
    ESC --> LEDGER[Stellar Ledger XLM]
```

---

## 5. Data Flow - Full System

```mermaid
flowchart TD
    U[User Browser] -->|1 Register and Login| BE[Backend API]
    BE -->|2 Store profile| DB[PostgreSQL]
    DB -->|3 Return user_id| BE
    BE -->|4 Return JWT| U

    U -->|5 Upload product image| BE
    BE -->|6 Pin image| IPFS[IPFS Pinata]
    IPFS -->|7 Return CID| BE
    BE -->|8 Store metadata| DB

    U -->|9 Call list_product| MC[Marketplace Contract]
    MC -->|10 Emit ProductListed| XLM[Stellar Ledger]

    U -->|11 Place order with XLM| EC[Escrow Contract]
    EC -->|12 Lock funds| XLM
    EC -->|13 Emit OrderCreated| XLM
    BE -->|14 Notify farmer| U

    U -->|15 Farmer marks shipped| EC
    EC -->|16 Emit Shipped| XLM

    U -->|17 Buyer confirms delivery| EC
    EC -->|18 Release funds to farmer| XLM
    EC -->|19 Emit OrderComplete| XLM
    BE -->|20 Record receipt| DB
```

---

## 6. Flow 1 - User Registration and Verification

```mermaid
sequenceDiagram
    participant User
    participant UI as React App
    participant BE as Backend API
    participant DB as PostgreSQL
    participant FW as Freighter Wallet
    participant RC as Registry Contract

    User->>UI: Fill registration form
    UI->>FW: Request wallet connect
    FW-->>UI: Return public key
    UI->>BE: POST /auth/register
    BE->>DB: INSERT user record
    DB-->>BE: user_id
    BE-->>UI: JWT token
    UI->>FW: Sign registerUser transaction
    FW-->>UI: Signed transaction
    UI->>RC: register_user(public_key, role, hash)
    RC-->>UI: Success
    UI->>BE: PATCH /users/verify-chain
    BE->>DB: Mark user chain-verified
    BE-->>UI: Verified status
    UI-->>User: Open Dashboard
```

**Data stored per user:**

| Field | On-Chain Registry | Off-Chain DB |
|---|---|---|
| public_key | Yes | Yes |
| role | Yes (Farmer or Buyer) | Yes |
| metadata_hash | Yes (IPFS CID hash) | No |
| name, phone, location | No | Yes |
| kyc_status | No | Yes |
| created_at | No | Yes |

---

## 7. Flow 2 - Product Listing

```mermaid
sequenceDiagram
    participant Farmer
    participant UI as React App
    participant BE as Backend API
    participant IPFS as Pinata IPFS
    participant DB as PostgreSQL
    participant FW as Freighter Wallet
    participant MC as Marketplace Contract

    Farmer->>UI: Fill product form
    UI->>BE: POST /products
    BE->>IPFS: Pin product images
    IPFS-->>BE: image CIDs
    BE->>DB: INSERT product record
    DB-->>BE: product_id
    BE-->>UI: product_id and metadata hash
    UI->>FW: Sign list_product transaction
    FW-->>UI: Signed transaction
    UI->>MC: list_product(id, price, qty, hash)
    MC-->>UI: on_chain_product_id
    UI->>BE: PATCH /products/activate
    BE->>DB: UPDATE product to active
    BE-->>UI: Product live
    UI-->>Farmer: Product listed
```

**Product data model:**

```
Product {
  id             UUID
  on_chain_id    u64
  farmer_pk      Address
  name           String
  category       Enum  (grain, vegetable, fruit, dairy, livestock)
  quantity       u64
  unit           Enum  (kg, ton, piece, liter)
  price_xlm      i128
  image_cids     Vec<String>
  metadata_hash  BytesN<32>
  status         Enum  (pending, active, sold, cancelled)
  created_at     Timestamp
}
```

---

## 8. Flow 3 - Order Placement and Escrow Lock

```mermaid
sequenceDiagram
    participant Buyer
    participant UI as React App
    participant FW as Freighter Wallet
    participant MC as Marketplace Contract
    participant EC as Escrow Contract
    participant XLM as Stellar Ledger
    participant BE as Backend API
    participant Farmer

    Buyer->>UI: Select product and confirm order
    UI->>MC: get_product(on_chain_id)
    MC-->>UI: Product details and price
    UI->>BE: POST /orders
    BE-->>UI: order_id
    UI->>FW: Sign create_order with XLM
    FW-->>UI: Signed transaction
    UI->>EC: create_order(order_id, product_id, farmer, buyer, amount)
    EC->>XLM: Lock XLM in escrow
    XLM-->>EC: Funds locked
    EC-->>UI: OrderCreated event
    UI->>BE: PATCH /orders with escrow_id
    BE-->>Farmer: Notify new order
    UI-->>Buyer: Order confirmed
```

---

## 9. Flow 4 - Delivery and Payment Release

```mermaid
sequenceDiagram
    participant Farmer
    participant Buyer
    participant UI as React App
    participant FW as Freighter Wallet
    participant EC as Escrow Contract
    participant XLM as Stellar Ledger
    participant BE as Backend API

    Farmer->>UI: Click Mark as Shipped
    UI->>BE: POST /orders/ship
    BE-->>UI: OK
    UI->>FW: Sign mark_shipped transaction
    FW-->>UI: Signed transaction
    UI->>EC: mark_shipped(order_id, tracking_hash)
    EC-->>UI: Shipped event emitted
    BE-->>Buyer: Notify order on the way

    Buyer->>UI: Click Confirm Delivery
    UI->>FW: Sign confirm_delivery transaction
    FW-->>UI: Signed transaction
    UI->>EC: confirm_delivery(order_id)
    EC->>XLM: Transfer XLM to Farmer wallet
    XLM-->>EC: Transfer complete
    EC-->>UI: OrderComplete event
    UI->>BE: PATCH /orders/complete
    BE-->>Farmer: Payment confirmed
    BE-->>Buyer: Receipt delivered
```

---

## 10. Flow 5 - Dispute Resolution

```mermaid
flowchart TD
    A[Raise Dispute] --> B[Submit Evidence via API]
    B --> C[Store Evidence in DB and IPFS]
    C --> D[Notify Admin]
    D --> E{Admin Reviews Evidence}
    E --> F[Farmer at Fault]
    E --> G[Buyer at Fault]
    E --> H[Partial Fault]
    F --> I[refund_buyer called]
    G --> J[release_to_farmer called]
    H --> K[split_payment called]
    I --> L[XLM to Buyer - Refunded]
    J --> M[XLM to Farmer - Completed]
    K --> N[XLM Split - Partial]
```

---

## 11. Order State Machine

```mermaid
flowchart LR
    S([Start]) --> Created
    Created -->|XLM locked| Funded
    Funded -->|Farmer ships| Shipped
    Shipped -->|Buyer confirms| Delivered
    Delivered -->|Auto release| Completed
    Funded -->|Raise issue| Disputed
    Shipped -->|Raise issue| Disputed
    Disputed -->|Admin farmer wins| Completed
    Disputed -->|Admin buyer wins| Refunded
    Completed --> E([End])
    Refunded --> E
```

---

## 12. Smart Contract Design

### Registry Contract

```
Functions:
  register_user(env, address, role, metadata_hash) -> ()
  get_user(env, address) -> UserRecord
  is_verified(env, address) -> bool
  update_metadata(env, address, new_hash) -> ()

Struct UserRecord:
  address:       Address
  role:          Symbol     "Farmer" or "Buyer"
  metadata_hash: BytesN<32>
  registered_at: u64
  active:        bool
```

### Marketplace Contract

```
Functions:
  list_product(env, farmer, price, quantity, metadata_hash) -> u64
  update_product(env, farmer, product_id, price, quantity) -> ()
  delist_product(env, farmer, product_id) -> ()
  get_product(env, product_id) -> Product
  get_products_by_farmer(env, farmer) -> Vec<Product>
  get_all_active(env) -> Vec<Product>

Struct Product:
  id:            u64
  farmer:        Address
  price:         i128
  quantity:      u64
  metadata_hash: BytesN<32>
  status:        Symbol     "Active" or "Sold" or "Delisted"
  created_at:    u64
```

### Escrow Contract

```
Functions:
  create_order(env, order_id, product_id, farmer, buyer, amount) -> ()
  mark_shipped(env, order_id, caller, tracking_hash) -> ()
  confirm_delivery(env, order_id, caller) -> ()
  raise_dispute(env, order_id, caller, reason_hash) -> ()
  resolve_dispute(env, order_id, admin, resolution, farmer_pct) -> ()
  get_order(env, order_id) -> Order
  get_escrow_balance(env, order_id) -> i128

Auth:
  create_order     -> buyer must sign and send XLM
  mark_shipped     -> farmer only
  confirm_delivery -> buyer only
  raise_dispute    -> farmer or buyer
  resolve_dispute  -> admin address only

Struct Order:
  id:            u64
  product_id:    u64
  farmer:        Address
  buyer:         Address
  amount:        i128
  status:        Symbol
  tracking_hash: BytesN<32>
  created_at:    u64
  updated_at:    u64
```

---

## 13. Frontend Architecture

### Page Map

```mermaid
graph TD
    HOME[Home Landing] --> AUTH[Connect Wallet]
    AUTH --> DASH_F[Farmer Dashboard]
    AUTH --> DASH_B[Buyer Dashboard]
    DASH_F --> LIST[List Product]
    DASH_F --> ORDERS_F[Farmer Orders]
    DASH_B --> MKT[Marketplace Browse]
    MKT --> PROD[Product Detail]
    PROD --> CHECKOUT[Place Order]
    CHECKOUT --> ORDERS_B[Buyer Orders]
    ORDERS_F --> ORDER[Order Detail]
    ORDERS_B --> ORDER
    ORDER --> HIST[Transaction History]
    AUTH --> ADMIN[Admin Panel]
```

### Component Tree

```
src/
  components/
    layout/
      Navbar.tsx
      Sidebar.tsx
      Footer.tsx
    wallet/
      WalletProvider.tsx
      ConnectButton.tsx
      WalletBadge.tsx
    marketplace/
      ProductCard.tsx
      ProductGrid.tsx
      ProductFilters.tsx
      ProductDetail.tsx
    farmer/
      ListProductForm.tsx
      ProductTable.tsx
      OrderTable.tsx
      ShipOrderButton.tsx
    buyer/
      OrderForm.tsx
      OrderCard.tsx
      ConfirmDeliveryButton.tsx
    shared/
      TxStatusToast.tsx
      DisputeModal.tsx
      ReceiptModal.tsx
      StatusBadge.tsx
  pages/
    Home.tsx
    AuthPage.tsx
    FarmerDashboard.tsx
    ListProduct.tsx
    Marketplace.tsx
    ProductPage.tsx
    OrderPage.tsx
    History.tsx
    AdminPanel.tsx
  hooks/
    useWallet.ts
    useContract.ts
    useOrders.ts
    useProducts.ts
  store/
    walletStore.ts
    orderStore.ts
  lib/
    stellar.ts
    soroban.ts
    api.ts
    ipfs.ts
  types/
    contracts.ts
    api.ts
```

---

## 14. Backend API Design

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | /auth/register | Create user and return JWT |
| POST | /auth/login | Verify wallet signature and return JWT |
| GET | /auth/me | Current user profile |

### Products

| Method | Endpoint | Description |
|---|---|---|
| GET | /products | List all active products paginated |
| GET | /products/:id | Single product detail |
| POST | /products | Create product and pin to IPFS |
| PATCH | /products/:id/activate | Link on-chain ID after tx confirmed |
| DELETE | /products/:id | Delist product |

### Orders

| Method | Endpoint | Description |
|---|---|---|
| GET | /orders | List orders role-filtered |
| GET | /orders/:id | Order detail |
| POST | /orders | Create order record |
| PATCH | /orders/:id/fund | Link escrow transaction |
| POST | /orders/:id/ship | Record shipping info |
| POST | /orders/:id/complete | Mark complete and generate receipt |
| POST | /orders/:id/dispute | Raise dispute |
| PATCH | /orders/:id/resolve | Admin resolve dispute |

### Users

| Method | Endpoint | Description |
|---|---|---|
| GET | /users/:publicKey | User profile |
| PATCH | /users/verify-chain | Mark on-chain verified |
| GET | /users/:publicKey/history | Transaction history |

---

## 15. Project Directory Structure

```
FarmChain/
├── contracts/
│   ├── registry/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── test.rs
│   ├── marketplace/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── test.rs
│   ├── escrow/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       └── test.rs
│   └── Cargo.toml
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── lib/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── products.ts
│   │   │   ├── orders.ts
│   │   │   └── users.ts
│   │   ├── services/
│   │   │   ├── stellar.ts
│   │   │   ├── ipfs.ts
│   │   │   ├── receipt.ts
│   │   │   └── notify.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── validate.ts
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   └── client.ts
│   │   └── index.ts
│   ├── tsconfig.json
│   └── package.json
├── docs/
│   ├── FarmChain.pdf
│   └── PLAN.md
├── scripts/
│   ├── deploy.sh
│   ├── seed.sh
│   └── fund-testnet.sh
├── .github/
│   └── workflows/
│       ├── contracts.yml
│       ├── frontend.yml
│       └── backend.yml
├── .vscode/
│   └── extensions.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 16. Development Phases

### Phase 1 - Foundation (Week 1-2)

- [ ] Repo scaffold: workspace Cargo.toml, Vite React app, Express backend
- [ ] Docker Compose: PostgreSQL + Stellar Quickstart node
- [ ] Freighter wallet integration in React
- [ ] Registry contract: write, test, deploy to testnet
- [ ] User registration flow end-to-end

### Phase 2 - Marketplace (Week 3-4)

- [ ] Marketplace contract: write, test, deploy
- [ ] IPFS image upload via Pinata
- [ ] Product listing form in React
- [ ] Marketplace browse page with filters
- [ ] Product detail page
- [ ] Backend product endpoints and DB schema

### Phase 3 - Escrow and Orders (Week 5-6)

- [ ] Escrow contract: write, test, deploy
- [ ] Order placement flow with XLM payment
- [ ] Order state machine on frontend
- [ ] mark_shipped and confirm_delivery flows
- [ ] Horizon event listener in backend
- [ ] Digital receipt generation

### Phase 4 - Dispute and Admin (Week 7)

- [ ] Dispute contract functions and UI
- [ ] Admin panel with dispute queue
- [ ] Notification service
- [ ] Transaction history page

### Phase 5 - Polish and Deploy (Week 8)

- [ ] End-to-end testing
- [ ] CI/CD GitHub Actions pipelines
- [ ] Mainnet deployment preparation
- [ ] Responsive mobile UI pass
- [ ] README and onboarding docs

---

## 17. Environment Setup

```bash
# 1. Rust + Soroban
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
cargo install --locked soroban-cli

# 2. Node.js v20 via nvm
nvm install 20 && nvm use 20

# 3. Install dependencies
cd frontend && npm install
cd ../backend && npm install

# 4. Start local services
docker compose up -d

# 5. Fund testnet accounts
./scripts/fund-testnet.sh

# 6. Deploy contracts
cd contracts && soroban build
./scripts/deploy.sh

# 7. Run dev servers
cd backend  && npm run dev   # port 4000
cd frontend && npm run dev   # port 5173
```

**Freighter testnet setup:**

1. Install Freighter browser extension at freighter.app
2. Settings -> Network -> switch to Testnet
3. Create or import a keypair
4. Run ./scripts/fund-testnet.sh with your public key

---

> FarmChain - No middlemen. No delays. Just fair trade, powered by Stellar.
