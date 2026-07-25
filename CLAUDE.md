# Fabrything Mobile Apps

Three Expo (React Native) apps for the Fabrything food-delivery marketplace:
**Customer**, **Rider**, **Restaurant/Partner**. They consume the Django API
that lives in the sibling repo `../fabrythingweb`, live at
`https://fabrythingweb.onrender.com/api/`. **The food API is the contract** —
when in doubt about a request/response shape, go read the Django views in
`fabrythingweb/food/` rather than guessing.

This repo has no backend code and no web code. If a task needs a new
endpoint, field, or business rule, that change belongs in `fabrythingweb/`,
not here.

## Monorepo layout

npm workspaces (see root `package.json`, `workspaces: ["packages/*", "apps/*"]`):

- `packages/core` — `@fabrything/core`, all shared logic (see below).
- `apps/customer`, `apps/rider`, `apps/restaurant` — one thin Expo Router app
  each, package names `@fabrything/customer` / `@fabrything/rider` /
  `@fabrything/restaurant`.

### The golden rule

**Shared logic lives in `packages/core`; apps stay thin.** An app is just:
a login screen, a handful of screens under `app/` that call `api` (from that
app's own `src/providers.tsx`) and pull user-facing strings from core's i18n,
plus its own branding (`app.config.ts`, `assets/`, `eas.json`). Business
logic, API calls, auth, theming, and copy go in core so all three apps share
one implementation and one set of tests.

### What `@fabrything/core` exports (`packages/core/src/index.ts`)

- `getApiBaseUrl` — reads `EXPO_PUBLIC_API_URL`, falls back to
  `https://fabrythingweb.onrender.com/api/` (`src/env.ts`).
- `createApiClient(store)` — axios instance with JWT `Authorization` header
  injection and single-flight 401 refresh-and-retry (`src/api/client.ts`).
- `TokenStore` interface (`src/api/tokenStore.ts`) and `endpoints`
  (`src/api/endpoints.ts` — `login`, `refresh`, `restaurants`, `riderMe`,
  `vendorRestaurant`, `deviceRegister`, `deviceUnregister`, `riderPrivacy`,
  `mobileConfig`, `notifications`).
- `makeSecureTokenStore()` — `expo-secure-store`-backed `TokenStore`
  (`src/auth/secureTokenStore.ts`).
- `login(api, identifier, password)`, `AuthProvider`, `useAuth()`
  (`src/auth/login.ts`, `src/auth/useAuth.tsx`) — session restore from a
  stored access token, sign-in/sign-out.
- i18n: `t(key, lang)`, `strings` (en/bn, bn falls back to en) —
  `src/i18n/`.
- `theme` / `brand` tokens (light/dark "spice market" palette matching
  `fabrythingweb`'s `src/food/theme.js`) — `src/theme/tokens.ts`.
- `registerForPush(api, app, deps)` — dependency-injected Expo push
  registration, posts to `endpoints.deviceRegister` — `src/push/register.ts`.
- `fetchMobileConfig(api)`, `isVersionSupported(current, min)` — public
  mobile-config + version gate — `src/config/mobileConfig.ts`,
  `src/config/version.ts`.

## Auth reality (saves future debugging)

All three roles log in through `store/auth/login/`. **The response is FLAT**
`{access, refresh, message}` — there is no nested user object. `role` and
`username` are **JWT claims on the access token**, decoded client-side with
`jwt-decode` (see `login()` in `packages/core/src/auth/login.ts`). Token
refresh is `store/auth/refresh/`. Do not assume a `/me` call or a nested
`user` field exists in the login response — they don't.

## App identities

| App        | Bundle / package ID          |
| ---------- | ----------------------------- |
| Customer   | `com.fabrything.customer`      |
| Rider      | `com.fabrything.rider`         |
| Restaurant | `com.fabrything.restaurant`    |

## How to add a screen

1. Add a file under `apps/<app>/app/` — Expo Router turns each file into a
   route (e.g. `apps/customer/app/orders.tsx` → `/orders`).
2. Import `api` from that app's `src/providers.tsx` (already wired with
   `createApiClient` + `AuthProvider`) for network calls.
3. Pull any user-facing copy from `@fabrything/core`'s `t()`/`strings`
   instead of hardcoding English.
4. If the logic is more than screen glue (a new API shape, a new auth rule,
   a new computed value), put it in `packages/core` and import it — don't
   duplicate it per app.

## Commands

- Install: `npm install` (root, installs all workspaces).
- Typecheck everything: `npm run typecheck` (root script, runs
  `tsc --noEmit` across `packages/core` + all three apps via
  `--workspaces --if-present`).
- Test everything (matches CI): `npm test --workspaces --if-present -- --runInBand`.
- Test one workspace: `npm --workspace @fabrything/<app> test` (also valid
  for `@fabrything/core`).
- Typecheck one workspace: `npm --workspace @fabrything/<app> run typecheck`.
- Build an installable Android APK: `cd apps/<app> && eas build --profile preview --platform android`
  (produces a `.apk` via the `preview` EAS profile; full walkthrough,
  including one-time account setup and iOS/production/store submission, in
  `docs/RELEASE.md`).
- Local bundle sanity check (no EAS account needed): `cd apps/<app> && npx expo export --platform android`.

## Key configs

- Each app has its own `metro.config.js` with `watchFolders` pointed at the
  monorepo root, plus `resolver.nodeModulesPaths`/`disableHierarchicalLookup`,
  so Metro resolves `@fabrything/core`'s TypeScript source directly (no
  build step for core). Don't remove this when touching an app's Metro
  config.
- Jest uses the `jest-expo` preset; Jest itself is pinned to `^29` across
  the workspace because `jest-expo@57` requires Jest 29 — do not bump Jest
  to 30 without also confirming `jest-expo` support.
- SDK 57 configures splash via the `expo-splash-screen` **plugin** entry in
  each `app.config.ts` (`plugins: [['expo-splash-screen', {...}]]`) — there
  is no top-level `splash` key anymore; don't add one.
- `.github/workflows/mobile-ci.yml` runs `npm run typecheck` then
  `npm test --workspaces --if-present -- --runInBand` on every PR and on
  push to `main`/`master`. It intentionally does **not** run `eas build` —
  no Expo/Apple/Google developer account exists yet (see `docs/RELEASE.md`).

## Pointers

- Design spec: `docs/superpowers/specs/2026-07-24-mobile-foundation-design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-24-mobile-foundation.md`
- Release / EAS build & submit guide: `docs/RELEASE.md`
- Handoff (push to GitHub, resume on another machine, build test APKs,
  what's shipped vs. pending): `docs/HANDOFF.md`
- Backend + web repo (the API contract lives here): sibling directory
  `../fabrythingweb`
