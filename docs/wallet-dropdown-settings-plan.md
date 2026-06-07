# Wallet Account Dropdown & Settings — Implementation Plan

> **Project:** FarmChain (Stellar-based agricultural marketplace)
> **Branch target:** `style/landing_page` → merge into `main`
> **Date:** 2026-06-06
> **Author:** ombima56

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Codebase Analysis Summary](#2-codebase-analysis-summary)
3. [User Stories](#3-user-stories)
4. [UX / UI Plan](#4-ux--ui-plan)
5. [Wireframes (ASCII)](#5-wireframes-ascii)
6. [Technical Architecture](#6-technical-architecture)
7. [Database Design](#7-database-design)
8. [API Design](#8-api-design)
9. [Security Considerations](#9-security-considerations)
10. [Implementation Phases](#10-implementation-phases)
11. [Development Timeline](#11-development-timeline)
12. [Risks & Mitigation](#12-risks--mitigation)
13. [Future Enhancements](#13-future-enhancements)

---

## 1. Feature Overview

### What we are building

A **wallet account dropdown menu** that appears when a user clicks their wallet address / profile indicator in the navigation bar. The dropdown will:

- Show a summary of the connected wallet identity.
- Provide quick wallet actions (copy address, disconnect, switch / import account).
- Surface a full **Settings page** (profile, security, notifications, privacy, marketplace preferences).
- Remain consistent with the existing green-based design system and Tailwind CSS 4 patterns already used throughout FarmChain.

### Why it matters

FarmChain currently exposes only a **Disconnect** button next to the wallet address. This is a dead-end for users who want to update their shipping address, notification preferences, or view their security settings. Web3 applications lose user trust when account management feels incomplete; adding a first-class settings experience reduces drop-off and supports future marketplace features (delivery, multi-account farming co-ops, etc.).

---

## 2. Codebase Analysis Summary

### Stack confirmed

| Layer | Technology |
|---|---|
| Frontend framework | React 19.2 + TypeScript 6 + Vite 8 |
| Styling | Tailwind CSS 4 (no separate config file; imported via `@import "tailwindcss"`) |
| State management | Zustand 5 (`walletStore` — persisted to `localStorage` key `"farmchain-wallet"`) |
| Routing | React Router v7 (`BrowserRouter`, `ProtectedRoute` with role guard) |
| Forms | React Hook Form 7 + Zod 4 |
| HTTP client | Axios (request interceptor injects `Authorization: Bearer {token}`) |
| Wallet | Freighter API 6 (SEP-10 challenge-response auth) |
| Blockchain | Stellar Testnet, Soroban smart contracts (Rust/WASM) |
| Backend | Express.js 5, PostgreSQL (pg pool), JWT (7d), Pinata/IPFS |

### Relevant existing files

```
frontend/src/
  components/layout/Navbar.tsx          ← target for dropdown trigger
  components/shared/TxStatusToast.tsx   ← reuse pattern for copy-toast
  components/shared/StatusBadge.tsx     ← color token reference
  hooks/useWallet.ts                    ← wallet connect / disconnect logic
  store/walletStore.ts                  ← Zustand wallet state
  lib/stellar.ts                        ← Freighter helpers
  lib/api.ts                            ← Axios instance
  pages/FarmerDashboard.tsx             ← modal / table patterns to reuse
  pages/AuthPage.tsx                    ← form patterns to reuse

backend/src/
  routes/auth.ts                        ← challenge / login / register
  routes/users.ts                       ← /me, verify-chain, history
  middleware/auth.ts                    ← JWT verification
  db/client.ts                          ← pg pool
```

### Gaps identified

| Gap | Impact |
|---|---|
| No reusable dropdown component | Must build from scratch |
| No user profile / settings page | Must create |
| `users` table has only `name`, `phone`, `location` (single string) | Schema migration required |
| No notification preferences table | Must create |
| No audit / session log table | Must create for security settings |
| No toast utility for non-transaction events | Must extend or create |
| Buyer components directory is empty | Can be used for buyer-specific settings sub-components |

### Design tokens (observed)

```
Navbar bg:        bg-green-950
Primary buttons:  bg-green-700 hover:bg-green-600 text-white rounded-xl
Secondary:        border border-gray-300 text-gray-600 hover:bg-gray-50
Surfaces:         white / green-50 / green-100
Text primary:     gray-800
Text secondary:   gray-500
Borders:          gray-100 / gray-300
Danger:           red-600 / red-50
Warning:          yellow-500 / yellow-100
Border radius:    rounded-xl (cards), rounded-2xl (panels), rounded-full (pills)
Shadows:          shadow-sm, shadow-lg
```

---

## 3. User Stories

### Wallet Dropdown

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| WD-01 | Connected user | See my wallet avatar and truncated address at a glance | I can confirm which account is active |
| WD-02 | Connected user | Copy my full wallet address with one click | I can share it without typing |
| WD-03 | Connected user | See a success toast after copying | I know the copy succeeded |
| WD-04 | Connected user | Disconnect my wallet from the dropdown | I can log out without hunting for a button |
| WD-05 | Power user | Import an additional Freighter account | I can switch between farming and buying wallets |
| WD-06 | Multi-account user | Switch the active account | My dashboard reflects the correct wallet |

### Profile & Settings

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| PS-01 | Any user | Edit my full name, phone, and delivery address | Sellers can ship to me correctly |
| PS-02 | Any user | Set my country, county, city, and precise address | Logistics and payments are accurate |
| PS-03 | Any user | Use a map picker or GPS to set my location | I don't have to type a long address |
| PS-04 | Any user | Upload a profile photo | My marketplace listings feel personal |
| PS-05 | Any user | Configure which notifications I receive | I am not overwhelmed by emails/SMS |
| PS-06 | Any user | View and revoke active sessions | I can remove unknown devices |
| PS-07 | Any user | Download my data or request account deletion | I control my personal data |
| PS-08 | Farmer | Set my default payout wallet and preferred currency | Payments land in the right place |
| PS-09 | Buyer | Set delivery preferences and order history visibility | My buying experience is personalised |

---

## 4. UX / UI Plan

### 4.1 Wallet Dropdown

**Trigger:** Replace the current inline disconnect button in `Navbar.tsx` with a clickable **wallet chip** (green pill showing truncated address + green pulse dot). Clicking it opens the dropdown.

**Behaviour:**
- Toggles open/closed on the wallet chip click.
- Closes when user clicks outside (via `useEffect` + `document.addEventListener('mousedown', …)`).
- Closes when user presses `Escape`.
- Closes automatically after an action completes (e.g. copy, disconnect).
- Positioned: `absolute top-full right-0 mt-2` relative to the chip.
- Width: `w-72` (288 px) on desktop; full-width on mobile.
- `z-index: z-50` consistent with existing modals.

**Animation:** `transition-all duration-150 ease-out` — scale from 95 % to 100 % + fade in (`opacity-0 → opacity-100`).

**Sections (separated by thin dividers):**

```
┌─────────────────────────────────┐
│  [Avatar]  Display Name         │  ← Account info
│            GXXX…XXXX  [Copy]    │
├─────────────────────────────────┤
│  ⚙  Settings                   │  ← Opens settings modal/page
│  ↔  Switch Account             │
│  ＋  Import Account             │
├─────────────────────────────────┤
│  ⏏  Disconnect Wallet          │  ← Danger-styled (red text)
└─────────────────────────────────┘
```

### 4.2 Settings Experience

**Entry point:** Settings menu item in dropdown → opens a **full-page modal** (`fixed inset-0 z-50`) with a two-column layout on desktop (sidebar nav + content panel) and a stacked tab bar on mobile.

**Settings sections:**

| Tab | Icon | Content |
|---|---|---|
| Profile | 👤 | Name, phone, email (optional), photo |
| Location | 📍 | Country, county, city, address, map picker |
| Security | 🔒 | Sessions, 2FA info, activity log, recovery |
| Notifications | 🔔 | Transaction, marketplace, payment alerts |
| Privacy | 🛡 | Visibility, data export, deletion |
| Marketplace | 🛒 | Payment method, payout wallet, currency, language |

### 4.3 Toast / Copy Feedback

Reuse the existing `TxStatusToast` pattern but create a lighter **`CopyToast`** variant: small green banner at top-right, auto-dismisses after 2 s.

### 4.4 Accessibility

- All dropdown items are `role="menuitem"` inside a `role="menu"` container.
- Focus is trapped inside the dropdown while open; `Tab` cycles through items.
- `aria-expanded` on the trigger button reflects open/closed state.
- Settings modal uses `role="dialog"` with `aria-labelledby` pointing to the section heading.
- Color contrast meets WCAG AA (green-700 on white passes at ratio ~4.8:1).

### 4.5 Responsive Behaviour

| Breakpoint | Dropdown | Settings |
|---|---|---|
| Mobile (`< sm`) | Full-width, slides from top | Full-screen sheet, tab bar at bottom |
| Tablet (`sm–lg`) | 288 px anchored to chip | Full-screen modal, stacked tabs |
| Desktop (`≥ lg`) | 288 px anchored to chip | 960 px modal, sidebar nav + content |

---

## 5. Wireframes (ASCII)

### 5.1 Wallet Dropdown

```
  ┌─────────────────────────────────────────────────────────────────┐
  │  🌾 FarmChain          Marketplace  Dashboard  List Product      │
  │                                      ●  GAXK…9F3D  [Disconnect]  │
  └───────────────────────────────────────────┬─────────────────────┘
                                              │
                              ┌───────────────▼──────────────┐
                              │  ┌──────┐  Display Name       │
                              │  │  GF  │  Farmer / Buyer     │
                              │  └──────┘  GAXK…9F3D  [📋]   │
                              ├──────────────────────────────┤
                              │  ⚙  Settings                 │
                              │  ↔  Switch Account          │
                              │  ＋  Import Account          │
                              ├──────────────────────────────┤
                              │  ⏏  Disconnect Wallet  (red) │
                              └──────────────────────────────┘
```

### 5.2 Settings Overview (Desktop)

```
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  ✕  Settings                                                                 │
  ├─────────────────┬────────────────────────────────────────────────────────────┤
  │                 │                                                            │
  │  👤 Profile  ◀  │  Profile Information                                       │
  │  📍 Location    │  ─────────────────────────────────────────────────────     │
  │  🔒 Security    │  Full Name          [_________________________]            │
  │  🔔 Notifs      │  Phone Number       [_________________________]            │
  │  🛡 Privacy     │  Email (optional)   [_________________________]            │
  │  🛒 Marketplace │  Profile Photo      [📷 Upload]                            │
  │                 │                                                            │
  │                 │  ─────────────────────────────────────────────────────     │
  │                 │                          [Cancel]  [Save Changes]          │
  └─────────────────┴────────────────────────────────────────────────────────────┘
```

### 5.3 Location Settings

```
  ┌─────────────────┬────────────────────────────────────────────────────────────┐
  │                 │  Location Settings                                         │
  │  👤 Profile     │  ─────────────────────────────────────────────────────     │
  │  📍 Location ◀  │  Country            [Kenya ▼]                              │
  │  🔒 Security    │  County / State     [Nairobi ▼]                            │
  │  🔔 Notifs      │  City / Town        [_________________________]            │
  │  🛡 Privacy     │  Precise Address    [_________________________]            │
  │  🛒 Marketplace │                                                            │
  │                 │  ┌──────────────────────────────────────────────────────┐  │
  │                 │  │                                                      │  │
  │                 │  │   [ Interactive Map — Leaflet / Google Maps ]        │  │
  │                 │  │                                                      │  │
  │                 │  └──────────────────────────────────────────────────────┘  │
  │                 │  [📍 Use My GPS Location]                                  │
  │                 │                                                            │
  │                 │  ─────────────────────────────────────────────────────     │
  │                 │                          [Cancel]  [Save Changes]          │
  └─────────────────┴────────────────────────────────────────────────────────────┘
```

### 5.4 Security Settings

```
  ┌─────────────────┬────────────────────────────────────────────────────────────┐
  │  📍 Location    │  Security                                                  │
  │  🔒 Security ◀  │  ─────────────────────────────────────────────────────     │
  │  🔔 Notifs      │  ◉ Active Sessions                                         │
  │  🛡 Privacy     │  ┌────────────────────────────────────────────────────┐    │
  │  🛒 Marketplace │  │  Chrome · Ubuntu · Nairobi, KE  (current)    [—]  │    │
  │                 │  │  Firefox · Android                              [Revoke]│
  │                 │  └────────────────────────────────────────────────────┘    │
  │                 │                                                            │
  │                 │  ◉ Login Activity (last 5)                                 │
  │                 │  ┌────────────────────────────────────────────────────┐    │
  │                 │  │  2026-06-06  09:14  Chrome · Nairobi, KE   ✅     │    │
  │                 │  │  2026-06-05  22:01  Firefox · Nairobi, KE  ✅     │    │
  │                 │  └────────────────────────────────────────────────────┘    │
  │                 │                                                            │
  │                 │  ◉ Wallet Recovery                                         │
  │                 │  Freighter stores your secret key securely. Back up        │
  │                 │  your 12/24-word seed phrase from the Freighter extension. │
  └─────────────────┴────────────────────────────────────────────────────────────┘
```

### 5.5 Notification Settings

```
  ┌─────────────────┬────────────────────────────────────────────────────────────┐
  │  🔒 Security    │  Notification Preferences                                  │
  │  🔔 Notifs  ◀   │  ─────────────────────────────────────────────────────     │
  │  🛡 Privacy     │  Transaction Alerts      [In-app ✓]  [Email ✓]  [SMS ○]  │
  │  🛒 Marketplace │  Wallet Activity         [In-app ✓]  [Email ○]  [SMS ○]  │
  │                 │  Marketplace Updates     [In-app ✓]  [Email ✓]  [SMS ○]  │
  │                 │  Payment Confirmations   [In-app ✓]  [Email ✓]  [SMS ✓]  │
  │                 │  Dispute Notifications   [In-app ✓]  [Email ✓]  [SMS ✓]  │
  │                 │  Promotional / News      [In-app ○]  [Email ○]  [SMS ○]  │
  │                 │                                                            │
  │                 │  ─────────────────────────────────────────────────────     │
  │                 │                          [Cancel]  [Save Preferences]      │
  └─────────────────┴────────────────────────────────────────────────────────────┘
```

---

## 6. Technical Architecture

### 6.1 Frontend — Component Structure

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx                  ← MODIFY: replace disconnect btn with WalletChip
│   │   └── WalletChip.tsx              ← NEW: pill trigger for dropdown
│   ├── wallet/
│   │   ├── WalletDropdown.tsx          ← NEW: dropdown container
│   │   ├── WalletDropdownHeader.tsx    ← NEW: avatar + address + copy
│   │   ├── WalletDropdownActions.tsx   ← NEW: settings / switch / import / disconnect
│   │   └── WalletAvatar.tsx           ← NEW: deterministic avatar from publicKey
│   ├── settings/
│   │   ├── SettingsModal.tsx           ← NEW: full-page modal shell + sidebar nav
│   │   ├── tabs/
│   │   │   ├── ProfileTab.tsx          ← NEW
│   │   │   ├── LocationTab.tsx         ← NEW (map integration)
│   │   │   ├── SecurityTab.tsx         ← NEW
│   │   │   ├── NotificationsTab.tsx    ← NEW
│   │   │   ├── PrivacyTab.tsx          ← NEW
│   │   │   └── MarketplaceTab.tsx      ← NEW
│   │   └── SettingsSidebar.tsx         ← NEW: desktop sidebar nav
│   └── shared/
│       ├── TxStatusToast.tsx           ← existing — keep
│       ├── CopyToast.tsx               ← NEW: lightweight copy-success toast
│       ├── Toggle.tsx                  ← NEW: reusable toggle switch
│       ├── FormField.tsx               ← NEW: label + input + error wrapper
│       └── MapPicker.tsx               ← NEW: Leaflet map with marker
├── hooks/
│   ├── useWallet.ts                    ← MODIFY: add importAccount, switchAccount
│   ├── useDropdown.ts                  ← NEW: open/close/outside-click logic
│   ├── useSettings.ts                  ← NEW: fetch/update user settings
│   ├── useClipboard.ts                 ← NEW: copy-to-clipboard with feedback
│   └── useGeolocation.ts              ← NEW: browser GPS wrapper
├── store/
│   ├── walletStore.ts                  ← MODIFY: add accounts[], activeIndex
│   └── settingsStore.ts               ← NEW: profile/notification state cache
├── pages/
│   └── (no new pages — Settings is a modal)
└── types/
    └── index.ts                        ← MODIFY: add UserProfile, NotificationPrefs, etc.
```

### 6.2 State Management

#### walletStore (Zustand — extended)

```typescript
interface WalletState {
  // existing
  publicKey: string | null;
  role: 'Farmer' | 'Buyer' | 'Admin' | null;
  token: string | null;
  connected: boolean;
  // new
  accounts: { publicKey: string; role: string; token: string }[];
  activeAccountIndex: number;
  displayName: string | null;
  avatarUrl: string | null;

  // actions
  setWallet(data: WalletData): void;
  disconnect(): void;
  addAccount(data: WalletData): void;
  switchAccount(index: number): void;
  setDisplayName(name: string): void;
}
```

#### settingsStore (Zustand — new, NOT persisted to localStorage)

```typescript
interface SettingsState {
  profile: UserProfile | null;
  notifications: NotificationPrefs | null;
  loading: boolean;
  error: string | null;
  fetchSettings(): Promise<void>;
  updateProfile(data: Partial<UserProfile>): Promise<void>;
  updateNotifications(data: NotificationPrefs): Promise<void>;
}
```

### 6.3 Key Hooks

#### `useDropdown`

```typescript
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, []);

  return { open, setOpen, ref };
}
```

#### `useClipboard`

```typescript
function useClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), timeout);
  }, [timeout]);
  return { copied, copy };
}
```

#### `useGeolocation`

```typescript
function useGeolocation() {
  const [coords, setCoords] = useState<GeolocationCoordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords(pos.coords),
      (err) => setError(err.message)
    );
  }, []);
  return { coords, error, request };
}
```

### 6.4 Location / Map Integration

**Recommended library:** `react-leaflet` + `leaflet` (open-source, no API key required for tiles).

**Tiles provider:** OpenStreetMap (free) or optionally Google Maps (requires billing setup).

**Address autocomplete:** `nominatim` (OpenStreetMap geocoding API — free, no key needed).

**Reverse geocoding:** Nominatim `reverse` endpoint → fill address fields from GPS coordinates.

**Implementation steps:**
1. `npm install react-leaflet leaflet @types/leaflet` in `frontend/`.
2. Import Leaflet CSS in `index.css`.
3. `MapPicker` renders a `MapContainer` with a draggable `Marker`.
4. On marker drag-end, call Nominatim reverse geocode and update form fields.
5. "Use GPS" button calls `useGeolocation`, centers map, drops marker, calls reverse geocode.

### 6.5 Wallet Avatar Generation

Generate a deterministic avatar from the public key (no image required):

```typescript
// WalletAvatar.tsx
// Use first 2 chars of publicKey as initials + hash-based hue for background color
function getHue(pk: string): number {
  let hash = 0;
  for (const ch of pk) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return hash % 360;
}

function WalletAvatar({ publicKey, size = 40 }: Props) {
  const hue = getHue(publicKey);
  return (
    <div
      style={{ background: `hsl(${hue}, 55%, 38%)`, width: size, height: size }}
      className="rounded-full flex items-center justify-center text-white font-bold text-sm select-none"
    >
      {publicKey.slice(0, 2).toUpperCase()}
    </div>
  );
}
```

This produces unique, visually distinct avatars for every Stellar public key without requiring image uploads.

### 6.6 Import Account Flow

Freighter supports only one active account at a time. "Import Account" means:

1. Call `requestAccess()` (prompts user to switch in Freighter extension).
2. Call `getAddress()` to read the newly active address.
3. If the address differs from the current one → run the SEP-10 challenge/login flow for the new key.
4. Store the new `{ publicKey, role, token }` in `walletStore.accounts[]`.
5. `switchAccount(index)` sets `walletStore.activeAccountIndex` and reloads the page context (or triggers a navigate to dashboard).

**Duplicate prevention:** Before adding, check `accounts.map(a => a.publicKey).includes(newKey)`.

---

## 7. Database Design

### 7.1 Migration — Extend `users` table

```sql
-- Migration: 001_extend_users.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS avatar_url     TEXT,
  ADD COLUMN IF NOT EXISTS country        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS county         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS city           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_line   TEXT,
  ADD COLUMN IF NOT EXISTS latitude       DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude      DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS payout_wallet  VARCHAR(60),
  ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'XLM',
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW();

-- Rename existing location (single string) to raw_location for backward compat
ALTER TABLE users RENAME COLUMN location TO raw_location;
```

### 7.2 New `user_notifications` table

```sql
CREATE TABLE IF NOT EXISTS user_notifications (
  public_key          VARCHAR(60) PRIMARY KEY REFERENCES users(public_key) ON DELETE CASCADE,
  txn_inapp           BOOLEAN NOT NULL DEFAULT TRUE,
  txn_email           BOOLEAN NOT NULL DEFAULT TRUE,
  txn_sms             BOOLEAN NOT NULL DEFAULT FALSE,
  wallet_inapp        BOOLEAN NOT NULL DEFAULT TRUE,
  wallet_email        BOOLEAN NOT NULL DEFAULT FALSE,
  wallet_sms          BOOLEAN NOT NULL DEFAULT FALSE,
  marketplace_inapp   BOOLEAN NOT NULL DEFAULT TRUE,
  marketplace_email   BOOLEAN NOT NULL DEFAULT TRUE,
  marketplace_sms     BOOLEAN NOT NULL DEFAULT FALSE,
  payment_inapp       BOOLEAN NOT NULL DEFAULT TRUE,
  payment_email       BOOLEAN NOT NULL DEFAULT TRUE,
  payment_sms         BOOLEAN NOT NULL DEFAULT TRUE,
  dispute_inapp       BOOLEAN NOT NULL DEFAULT TRUE,
  dispute_email       BOOLEAN NOT NULL DEFAULT TRUE,
  dispute_sms         BOOLEAN NOT NULL DEFAULT TRUE,
  promo_inapp         BOOLEAN NOT NULL DEFAULT FALSE,
  promo_email         BOOLEAN NOT NULL DEFAULT FALSE,
  promo_sms           BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.3 New `user_sessions` table

```sql
CREATE TABLE IF NOT EXISTS user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_key    VARCHAR(60) NOT NULL REFERENCES users(public_key) ON DELETE CASCADE,
  token_hash    VARCHAR(64) NOT NULL,       -- SHA-256 of the JWT for revocation
  user_agent    TEXT,
  ip_address    INET,
  country       VARCHAR(100),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  revoked       BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_public_key ON user_sessions(public_key);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON user_sessions(token_hash);
```

### 7.4 New `user_privacy` table

```sql
CREATE TABLE IF NOT EXISTS user_privacy (
  public_key              VARCHAR(60) PRIMARY KEY REFERENCES users(public_key) ON DELETE CASCADE,
  profile_visible         BOOLEAN NOT NULL DEFAULT TRUE,   -- visible in marketplace listings
  show_wallet_address     BOOLEAN NOT NULL DEFAULT TRUE,
  allow_marketing_contact BOOLEAN NOT NULL DEFAULT FALSE,
  data_export_requested_at TIMESTAMPTZ,
  deletion_requested_at   TIMESTAMPTZ
);
```

### 7.5 Entity Relationship Summary

```
users (public_key PK)
  ├── user_notifications (1:1, FK public_key)
  ├── user_sessions      (1:N, FK public_key)
  └── user_privacy       (1:1, FK public_key)
```

---

## 8. API Design

All new endpoints require `Authorization: Bearer {jwt}` and use the existing `auth` middleware.

### 8.1 Profile

| Method | Path | Description |
|---|---|---|
| `GET` | `/users/me` | Return full profile (already exists — extend response) |
| `PATCH` | `/users/me/profile` | Update name, phone, email, avatar, location fields |
| `POST` | `/users/me/avatar` | Upload profile photo (multipart, store CID on Pinata) |

**PATCH `/users/me/profile` request body:**

```json
{
  "name": "Hillary Ombi",
  "phone": "+254712345678",
  "email": "user@example.com",
  "country": "Kenya",
  "county": "Nairobi",
  "city": "Nairobi",
  "address_line": "123 Kimathi Street",
  "latitude": -1.286389,
  "longitude": 36.817223,
  "preferred_currency": "KES",
  "preferred_language": "en",
  "payout_wallet": "GAXK...9F3D"
}
```

**Response:** `200 { user: UserProfile }`

**Validation (Zod):**

```typescript
const profileSchema = z.object({
  name:               z.string().min(2).max(100).optional(),
  phone:              z.string().regex(/^\+\d{7,15}$/).optional(),
  email:              z.string().email().optional().nullable(),
  country:            z.string().max(100).optional(),
  county:             z.string().max(100).optional(),
  city:               z.string().max(100).optional(),
  address_line:       z.string().max(500).optional(),
  latitude:           z.number().min(-90).max(90).optional(),
  longitude:          z.number().min(-180).max(180).optional(),
  preferred_currency: z.enum(['XLM', 'KES', 'USD', 'EUR']).optional(),
  preferred_language: z.enum(['en', 'sw', 'fr']).optional(),
  payout_wallet:      z.string().regex(/^G[A-Z2-7]{55}$/).optional(),
});
```

### 8.2 Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/users/me/notifications` | Get notification preferences |
| `PUT` | `/users/me/notifications` | Replace all notification preferences |

### 8.3 Sessions

| Method | Path | Description |
|---|---|---|
| `GET` | `/users/me/sessions` | List active sessions |
| `DELETE` | `/users/me/sessions/:id` | Revoke a session |
| `DELETE` | `/users/me/sessions` | Revoke all other sessions |

**Session recording:** Modify `auth.ts` login handler to insert a row into `user_sessions` on every successful login, storing `SHA-256(jwt)`, `User-Agent`, `IP`.

**Session revocation check:** In `middleware/auth.ts`, after JWT decode, run:

```sql
SELECT revoked FROM user_sessions WHERE token_hash = $1;
```

If `revoked = true`, return `401 Unauthorized`.

### 8.4 Privacy

| Method | Path | Description |
|---|---|---|
| `GET` | `/users/me/privacy` | Get privacy settings |
| `PATCH` | `/users/me/privacy` | Update privacy preferences |
| `POST` | `/users/me/export` | Queue data export (returns download URL or 202 Accepted) |
| `POST` | `/users/me/delete` | Request account deletion (soft-delete flag) |

### 8.5 Extended Response for `GET /users/me`

```json
{
  "publicKey": "GAXK...9F3D",
  "name": "Hillary Ombi",
  "role": "Farmer",
  "phone": "+254712345678",
  "email": "user@example.com",
  "avatarUrl": "https://gateway.pinata.cloud/ipfs/Qm...",
  "country": "Kenya",
  "county": "Nairobi",
  "city": "Nairobi",
  "addressLine": "123 Kimathi Street",
  "latitude": -1.286389,
  "longitude": 36.817223,
  "preferredCurrency": "KES",
  "preferredLanguage": "en",
  "payoutWallet": "GAXK...9F3D",
  "kycStatus": "verified",
  "chainVerified": true,
  "createdAt": "2026-01-15T08:00:00Z"
}
```

---

## 9. Security Considerations

### 9.1 Token Revocation

The current implementation does not support revocation — a stolen JWT is valid until expiry (7 days). With the new `user_sessions` table:

- Every JWT is associated with a `token_hash` row.
- The auth middleware checks `revoked = false` on each request (add Redis caching to avoid per-request DB hits in production).
- "Disconnect Wallet" should call `DELETE /users/me/sessions/current` before clearing local state.

### 9.2 Address Copy — No Risk

`navigator.clipboard.writeText()` requires HTTPS (already assumed for production). No server involvement.

### 9.3 Profile Data Validation

- All PATCH inputs are validated with Zod schemas on the **backend** (not just frontend).
- Email addresses must be verified before being used for notifications (send verification email with a token).
- Phone numbers validated against international format. SMS sending is deferred to Phase 3.

### 9.4 Avatar Upload

- Accept: `image/jpeg`, `image/png`, `image/webp` only.
- Maximum size: 2 MB.
- Process through `sharp` (resize to 256×256) before uploading to Pinata to prevent polyglot file exploits.

### 9.5 Location Data

- Store `latitude`/`longitude` as database `DECIMAL` fields (not free text) to prevent injection.
- Never expose precise location publicly — only use for delivery/logistics (visible only to order counterparty, not in marketplace listings by default).

### 9.6 Session Management

- `user_agent` and `ip_address` are stored for transparency to the user, not for tracking.
- IP stored as PostgreSQL `INET` type.
- Do not store raw JWTs — only their SHA-256 hash (`token_hash`).

### 9.7 Account Import / Switch

- When a new account is imported, run the full SEP-10 challenge/login to verify ownership.
- Never allow setting an arbitrary publicKey without cryptographic proof of control.
- Duplicate account prevention must be enforced on the frontend and backend.

### 9.8 CORS

- Backend already restricts origins. No change needed for new endpoints.

### 9.9 Rate Limiting

- Add `express-rate-limit` to: `/users/me/profile` (PATCH), `/users/me/avatar` (POST), `/users/me/delete` (POST).
- Recommendation: 10 requests / minute per IP for mutation endpoints.

### 9.10 2FA Note

Traditional 2FA (TOTP) is largely redundant for Freighter-based auth because the wallet itself (Freighter extension + secret key) serves as the second factor. Mention this in the Security tab UI. If email/password login is added in future, TOTP should be mandatory.

---

## 10. Implementation Phases

### Phase 1 — Wallet Dropdown (1 week)

**Goal:** Replace the inline disconnect button with a full dropdown.

**Tasks:**

- [ ] Create `WalletAvatar.tsx` (deterministic avatar from public key)
- [ ] Create `WalletChip.tsx` (pill trigger, replaces current address display)
- [ ] Create `useDropdown.ts` (open/close/outside-click/Escape)
- [ ] Create `useClipboard.ts` (copy + 2 s feedback)
- [ ] Create `WalletDropdown.tsx` (container with header, actions, footer)
- [ ] Create `WalletDropdownHeader.tsx` (avatar + address + copy button)
- [ ] Create `WalletDropdownActions.tsx` (settings, switch, import, disconnect)
- [ ] Create `CopyToast.tsx` (lightweight toast for copy success)
- [ ] Modify `Navbar.tsx` to use `WalletChip` + `WalletDropdown`
- [ ] Accessibility: `role="menu"`, `role="menuitem"`, `aria-expanded`, keyboard navigation
- [ ] Responsive: test on 375 px (iPhone SE), 768 px (tablet), 1440 px (desktop)

**Acceptance criteria:**
- Dropdown opens/closes on chip click, outside click, and Escape.
- Copy produces a toast within 100 ms.
- Disconnect clears store and redirects to `/`.
- All items are keyboard-navigable.

---

### Phase 2 — Settings Modal Shell + Profile Tab (1.5 weeks)

**Goal:** Full-page settings modal with sidebar + Profile and Location tabs working end-to-end.

**Tasks:**

**Frontend:**
- [ ] Create `SettingsModal.tsx` (fixed full-screen modal, sidebar + content)
- [ ] Create `SettingsSidebar.tsx` (6-tab nav, desktop sidebar / mobile tab bar)
- [ ] Create `ProfileTab.tsx` (name, phone, email, photo upload)
- [ ] Create `LocationTab.tsx` (country, county, city, address, MapPicker, GPS)
- [ ] Create `MapPicker.tsx` (`react-leaflet`, draggable marker, Nominatim reverse geocode)
- [ ] Create `useGeolocation.ts`
- [ ] Create `FormField.tsx` (label + input + Zod error display)
- [ ] Create `Toggle.tsx` (reusable toggle switch for notifications/privacy)
- [ ] Create `useSettings.ts` (fetch/update via API)
- [ ] Create `settingsStore.ts` (Zustand, non-persisted cache)
- [ ] Install: `react-leaflet leaflet @types/leaflet`

**Backend:**
- [ ] Write migration `001_extend_users.sql` and apply
- [ ] Extend `GET /users/me` response with new profile fields
- [ ] Add `PATCH /users/me/profile` with Zod validation
- [ ] Add `POST /users/me/avatar` (multipart, Pinata upload, `sharp` resize)
- [ ] Install backend: `sharp express-rate-limit`

**Acceptance criteria:**
- User can edit name, phone, email, photo and save.
- User can drop a pin on the map, see address fields auto-fill from reverse geocoding.
- GPS button requests browser location and centers the map.
- Invalid inputs show inline Zod errors.
- Save shows loading state → success toast → modal reflects updated data.

---

### Phase 3 — Security & Sessions Tab (1 week)

**Tasks:**

**Backend:**
- [ ] Write migration `002_user_sessions.sql` and apply
- [ ] Modify login handler to insert `user_sessions` row
- [ ] Modify auth middleware to check `revoked` flag
- [ ] Add `GET /users/me/sessions`
- [ ] Add `DELETE /users/me/sessions/:id`
- [ ] Add `DELETE /users/me/sessions` (revoke all others)
- [ ] Add rate limiting middleware

**Frontend:**
- [ ] Create `SecurityTab.tsx`
- [ ] Active sessions list with device/location info and Revoke buttons
- [ ] Login activity list (last 10 sessions, showing UA + date)
- [ ] Wallet recovery info section (static Freighter guidance)
- [ ] Modify `walletStore.disconnect()` to call `DELETE /users/me/sessions/current`

**Acceptance criteria:**
- Sessions list shows current session marked "(current)" and others with Revoke buttons.
- Revoking a session from another device invalidates that JWT on next API call.
- Disconnect button in dropdown clears local state AND revokes the session.

---

### Phase 4 — Notifications, Privacy & Marketplace Tabs (1 week)

**Tasks:**

**Backend:**
- [ ] Write migration `003_user_notifications.sql` + `004_user_privacy.sql` and apply
- [ ] Add `GET /users/me/notifications`, `PUT /users/me/notifications`
- [ ] Add `GET /users/me/privacy`, `PATCH /users/me/privacy`
- [ ] Add `POST /users/me/export` (stub returning 202 or download link)
- [ ] Add `POST /users/me/delete` (set `deletion_requested_at`, email admin)

**Frontend:**
- [ ] Create `NotificationsTab.tsx` (toggle grid: channel × event type)
- [ ] Create `PrivacyTab.tsx` (visibility toggles, export, deletion request)
- [ ] Create `MarketplaceTab.tsx` (payout wallet, currency, language, delivery prefs)

**Acceptance criteria:**
- Notification grid persists to backend and re-loads correctly on settings open.
- Data export request shows confirmation dialog before submitting.
- Account deletion request shows a multi-step confirmation (type "DELETE" to confirm).

---

### Phase 5 — Multi-Account Support (1 week)

**Tasks:**

**Frontend:**
- [ ] Extend `walletStore` with `accounts[]` and `activeAccountIndex`
- [ ] Implement `importAccount()` in `useWallet.ts` (requestAccess → new SEP-10 flow → addAccount)
- [ ] Implement `switchAccount(index)` in `useWallet.ts`
- [ ] Create `SwitchAccountModal.tsx` (list accounts, active indicator, remove button)
- [ ] Wire Import Account and Switch Account items in `WalletDropdownActions`

**Acceptance criteria:**
- User can import a second Freighter account after switching in the extension.
- Switching account updates all dashboard data to reflect the new wallet.
- Importing a duplicate address shows an error toast.

---

### Phase 6 — Polish, A11y & Testing (0.5 weeks)

**Tasks:**
- [ ] Full keyboard navigation audit (Tab, Enter, Escape, Arrow keys in dropdown menu)
- [ ] Screen-reader testing with NVDA/JAWS simulation (check aria labels)
- [ ] Mobile UX pass: settings as bottom sheet on iOS/Android screen sizes
- [ ] Loading skeleton states for settings tabs while API fetches
- [ ] Error boundary around `SettingsModal`
- [ ] Unit tests for: `useDropdown`, `useClipboard`, `WalletAvatar` hue function
- [ ] Integration tests for: profile update flow, session revocation

---

## 11. Development Timeline

```
Week 1    Phase 1  — Wallet Dropdown (complete)
Week 2–3  Phase 2  — Settings shell + Profile + Location tabs
Week 4    Phase 3  — Security & Sessions
Week 5    Phase 4  — Notifications, Privacy, Marketplace tabs
Week 6    Phase 5  — Multi-account support
Week 6.5  Phase 6  — Polish, accessibility, testing
```

**Total estimated effort:** ~6.5 weeks for one full-stack developer.

**With two developers (frontend + backend split):**
- Can compress to ~4 weeks (backend runs ahead, frontend consumes as APIs land).

---

## 12. Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Freighter `requestAccess()` requires user to manually switch account in extension | High | Medium | Document this UX clearly in the Import Account UI with a guided step-by-step tooltip |
| Map picker Leaflet tiles blocked on some networks | Medium | Low | Provide a text-only fallback; tiles are optional for address entry |
| Token revocation check adds latency to every API request | Medium | Medium | Cache revocation status in Redis with a 30 s TTL; tolerable for security settings use case |
| Nominatim free tier has rate limits (1 req/s) | Medium | Low | Debounce reverse-geocode calls on map drag-end (300 ms), add user-agent header per Nominatim policy |
| `sharp` native binary may not compile in some CI environments | Low | Medium | Pin to a tested version, use `@img/sharp-linux-x64` platform-specific package |
| Multi-account state grows unbounded in localStorage | Low | Low | Cap `accounts[]` at 5 entries; warn user on import if limit reached |
| Email verification adds complexity to Phase 2 | High | Low | Make email field optional and skip verification in MVP; add in Phase 4 |
| Avatar upload to Pinata fails during network outage | Low | Low | Fall back gracefully to deterministic `WalletAvatar`; photo upload is not blocking |

---

## 13. Future Enhancements

| Enhancement | Notes |
|---|---|
| **Push notifications (Web Push)** | Requires service worker + VAPID keys; deferred to post-launch |
| **Email verification flow** | Send link via SendGrid/Resend; add `email_verified` column to `users` |
| **SMS notifications** | Integrate Africa's Talking (Kenya) or Twilio; requires phone verification |
| **2FA via TOTP** | Add only if email/password login is introduced; Freighter IS the second factor today |
| **KYC integration** | Upload ID document to Pinata + admin verification flow |
| **Delivery address book** | Multiple saved delivery locations per user (shipping addresses) |
| **Wallet connect (non-Freighter)** | Albedo, xBull, LOBSTR — abstract behind an adapter interface |
| **Dark mode** | Tailwind CSS 4 supports `dark:` variants; add toggle in Marketplace tab |
| **Social login linking** | Link Google/Apple account to wallet for email-based recovery |
| **On-chain profile metadata** | Store profile IPFS hash in Registry smart contract for provenance |
| **Admin settings panel** | Dispute resolution, KYC review, user management (separate admin UI) |

---

*This document is the authoritative design reference for the wallet dropdown and settings feature. Implementation should start with Phase 1 and proceed sequentially, with backend migrations applied before frontend tabs that depend on new API fields.*
