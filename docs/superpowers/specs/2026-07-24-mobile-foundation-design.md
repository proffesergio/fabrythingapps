# Fabrything Mobile — Program + Foundation (SP0 + SP1) Design

**Date:** 2026-07-24
**Status:** Approved by product owner (Md Billal Hossain). Foundation detailed for implementation.
**Repos:** `fabrythingweb/` (existing Django API + React web) and `fabrythingapps/` (new Expo monorepo — this repo).

---

## 1. Mission & context

Fabrything runs a working **food-delivery marketplace** for a local/rural community area in
Bangladesh: Django REST backend (Render) + React/MUI web (Vercel) + Neon Postgres. The web
system is complete — customer ordering (browse → cart → COD checkout → tracking), a vendor
dashboard, a rider dashboard with a **live Leaflet/OSM map**, admin dispatch/settlements,
coupons, loyalty, and an in-app `Notification` model.

We now build **native mobile apps** so customers, riders, and restaurant owners can install
Fabrything on their phones and publish to Google Play + Apple App Store.

**Mission constraints (drive every choice):** low-bandwidth / flaky connectivity first;
COD-first; phone-centric identity; Bangla (bn) + English (en); Android-dominant audience;
rider **privacy** over location.

## 2. Locked decisions (from brainstorming, 2026-07-24)

| Decision | Choice |
|---|---|
| Framework | **React Native + Expo** (reuses the team's JS/React skills; EAS build/submit; Expo Push). |
| Packaging | **Three separate apps** (Customer, Rider, Restaurant), 3 store listings, sharing one `core` package — mirrors FoodPanda (app / rider / partner). |
| Repo | Separate **`fabrythingapps/`** monorepo, sibling of `fabrythingweb/`. Coupled only via the HTTP API. |
| First launch install | **Android-first**: APK + Google Play *internal testing*; iOS via **TestFlight**. Public store listings follow (SP5). |
| Notifications | **Expo Push now** (wraps FCM+APNs, free); **WhatsApp Cloud API later** (SP5). |
| Maps | **OpenStreetMap tiles** (no Google Maps key/cost — matches web Leaflet). Turn-by-turn hands off to the phone's map app. |
| Realtime | **Polling / heartbeat** (existing model). No WebSockets, no paid hosting required to launch. |
| Dev accounts | Owner has none yet; build production-ready and sequence account creation so **nothing is blocked now**. |
| State | **TanStack Query** for server state; food-cart logic ported from web `foodCartSlice`. |

## 3. Program decomposition (each sub-project = its own spec → plan → ship)

| # | Sub-project | Ships |
|---|---|---|
| **SP0** | Web quick-wins + mobile enablers (backend device tokens + Expo push + rider privacy flag + mobile-config; web Facebook/Messenger link) | Web PR + backend PR |
| **SP1** | Mobile foundation (Expo monorepo, shared `core`, EAS + CI, branding, login shell, push proven) | First installable **dev APK** + TestFlight |
| **SP2** | Customer app (home → browse → options → cart → COD checkout → my orders → live tracking + push) | Play internal + TestFlight |
| **SP3** | Rider app (availability + location-sharing consent + privacy toggle, offer countdown, active delivery, nav on/off, earnings, push) | Play internal + TestFlight |
| **SP4** | Restaurant app (incoming orders, accept→preparing→ready, quick menu/availability edits, open/close, push) | Play internal + TestFlight |
| **SP5** | WhatsApp Cloud API rider notifications + polish + **public** store listings | Public Play + App Store |

**Build order:** SP0 → SP1 → SP2 → SP3 → SP4 → SP5.
**This document specifies SP0 + SP1 (the "Foundation" deliverable).** SP2–SP5 get their own specs later.

## 4. Rider privacy model (carried through SP3, enabled in SP0)

- Location is broadcast **only** while the rider is on an **active delivery** AND has **consented** (`is_sharing_location = True`, default False).
- One-tap toggle stops sharing immediately (heartbeat sends no coordinates).
- Separate toggle `nav_display_enabled` switches between "show in-app navigation map" and "address-only, no map", so a rider may navigate with their own tools privately.
- The customer track endpoint returns the rider's position **only** for an active order whose rider is currently sharing; otherwise it returns status/ETA without coordinates.

---

## 5. SP0 — backend + web enablers (in `fabrythingweb`)

### 5.1 Backend (`food` app)

**`DeviceToken` model**
- `user` FK → `accounts.Users`; `expo_token` (unique, the ExpoPushToken string);
  `app` ∈ {`customer`,`rider`,`restaurant`}; `platform` ∈ {`ios`,`android`}; `enabled` (bool);
  `last_seen_at`; timestamps. Unique on `expo_token`; a user may have several (multiple devices/apps).

**Endpoints** (under `/api/food/`)
- `POST devices/register/` (auth) — upsert `{expo_token, app, platform}` for `request.user`; idempotent.
- `POST devices/unregister/` (auth) — disable the caller's token (on logout).
- `GET mobile/config/` (**AllowAny**) — `{ min_supported_version: {customer, rider, restaurant}, feature_flags, support: {facebook_url, messenger_url}, tile_url }`. Add `/api/food/mobile/` (or the specific path) to `PUBLIC_API_PREFIXES` so it bypasses `PermissionMiddleware`.

**Expo push send path**
- `food/services_push.py::send_expo_push(tokens, title, body, data=None)` — chunked POST to
  `https://exp.host/--/api/v2/push/send` using the **stdlib `urllib.request`** (no new backend
  dependency; `requests` is not installed). Handles Expo receipts/errors, disables tokens Expo
  reports as `DeviceNotRegistered`.
- **Single integration point:** wherever a `Notification` row is created today, also call `send_expo_push`
  for that user's enabled tokens. A helper `notify(user, title, body, order_code="", data=None)` creates the
  `Notification` **and** pushes, so existing call sites switch to one function. No flow rewrite.

**Rider privacy fields**
- Add `is_sharing_location` (bool, default False) and `nav_display_enabled` (bool, default True) to `Rider`.
- Heartbeat view: store `current_lat/lng` only when `is_sharing_location`; always update `last_seen_at`.
- Customer track endpoint: include rider coordinates only when the order is active **and** the assigned
  rider `is_sharing_location`.

### 5.2 Web (`frontend/ecommerce_inventory`)
- Add a Facebook + Messenger entry (icon + link) in the storefront layout and the food layout, pointing to
  `https://www.facebook.com/fabrything` and `https://m.me/fabrything`. Reuse the existing `facebook`
  reference in `StorefrontLayout.js` rather than duplicating; open in a new tab with `rel="noopener"`.

### 5.3 SP0 testing
- Django (`config.settings.test`, SQLite, isolated from Neon): device register requires auth + is idempotent;
  `send_expo_push` mocked (assert payload chunks + token disable on `DeviceNotRegistered`); track endpoint
  hides rider location when not sharing; `mobile/config` shape + public access.
- Web: FB/Messenger link renders with the correct `href`.

---

## 6. SP1 — mobile foundation (in `fabrythingapps`)

### 6.1 Monorepo
- npm workspaces (Expo-supported). `apps/{customer,rider,restaurant}`, `packages/core`.
- App IDs: `com.fabrything.customer`, `com.fabrything.rider`, `com.fabrything.restaurant`.
- Expo SDK (latest stable), Expo Router, TypeScript, `app.config.ts` per app (name, icon, splash, API URL via env).

### 6.2 `packages/core` (shared)
- `api/` — axios client: base URL from env (Render `/api/`), JWT + refresh interceptor, normalized errors;
  typed wrappers for existing DRF routes (auth, food public, orders, rider, vendor, notifications, devices, config).
- `auth/` — phone/email + password login (reuse `/api/auth/login`); tokens in `expo-secure-store`; auth
  context + `useAuth`; role guard.
- `i18n/` — en/bn dictionaries mirroring web; English fallback; language switch.
- `theme/` — tokens mapped from the web MUI theme (brand red/orange, spacing, radius) + logo assets; light/dark.
- `push/` — `registerForPush()` via `expo-notifications`; posts token to `devices/register/`; foreground/response
  handlers; falls back to in-app notification list when permission denied.
- `config/` — fetch `mobile/config`; version gate helper.
- `ui/` — shared primitives: `Screen`, `Button`, `Loading`, `EmptyState`, `OfflineBanner`.

### 6.3 Each app (foundation slice)
- Login screen → authenticated shell → one **real** home proving the full chain against the live API:
  - Customer: list ACTIVE restaurants (`/api/food/restaurants/`).
  - Rider: availability state + `rider/me`.
  - Restaurant: its own `vendor/restaurant`.
- Branding: per-app `icon.png` (1024), adaptive icon, splash — generated from existing
  `fabrythingweb/frontend/public/logo_square_light.png` / `logo_square_dark.png`, tinted per module.

### 6.4 Delivery / CI-CD
- `eas.json`: `development` (dev client), `preview` (**internal APK**, `android.buildType: apk`), `production`.
- GitHub Actions: typecheck + `jest` on PR; manual/tag-triggered `eas build`. API URL + secrets via EAS.
- **Accounts:** free **Expo account** needed for EAS builds (owner creates during SP1). Google Play ($25) /
  Apple ($99) needed only at SP2 submit. WhatsApp Business only at SP5.

### 6.5 Data flow, errors, resilience
- Server state via TanStack Query (retry, cache, `OfflineBanner`); 401 → silent refresh; version mismatch →
  force-update screen; push denied → in-app list. Location uses the existing polling/heartbeat model.

### 6.6 SP1 testing
- `jest` + `@testing-library/react-native`: api client attaches/refreshes auth; secure token storage; i18n
  fallback; version gate; per-app login + home smoke tests (mocked api).
- Build verification: `eas build --profile preview --platform android` yields an installable APK
  (requires the owner's Expo account; documented as the one external dependency).

### 6.7 Token-efficiency deliverables (explicit owner ask)
- `fabrythingapps/CLAUDE.md`: monorepo layout, per-app build/test/lint commands, API base, EAS profiles,
  "how to add a screen", reuse-`core` rule.
- Memory updates: `mobile-overview`, `mobile-foundation-decisions` (so future sessions skip re-derivation).

---

## 7. Foundation acceptance criteria (Definition of Done)
1. **SP0:** migrations apply on Postgres; `POST devices/register/` upserts (auth-gated); creating a
   `Notification` also sends an Expo push (mocked in tests); rider coordinates are hidden unless sharing on an
   active order; `GET mobile/config/` returns the documented shape publicly; SP0 tests pass.
2. **Web:** Facebook + Messenger link is visible in the storefront and food layouts with the correct hrefs.
3. **SP1:** the Expo monorepo builds; `packages/core` unit tests pass; each of the three apps logs in against
   the **live** API and renders its real home screen; branding (icon/splash) is applied per app.
4. **Install:** a `preview` Android **APK** can be produced and installed on a device (owner's Expo account).
5. `fabrythingapps/CLAUDE.md` and the two memory files exist.

## 8. Open questions / deferred
- SSLCommerz/bKash online payments in-app — deferred (web COD flow is the mobile launch target too).
- WhatsApp Cloud API templates/sender — SP5 (needs Meta WhatsApp Business account).
- Auto-dispatch tuning, group ordering, and any WebSocket upgrade — out of scope for Foundation.
