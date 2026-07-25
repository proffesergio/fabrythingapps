# Mobile Foundation (SP0+SP1) — Progress Ledger

Plan: fabrythingapps/docs/superpowers/plans/2026-07-24-mobile-foundation.md
Web repo: fabrythingweb @ branch feature/mobile-enablers (SP0, tasks 1-6)
Mobile repo: fabrythingapps @ master (SP1, tasks 7-17)

## Tasks
- Task 1 (web): DeviceToken model — complete (32f4536, review clean)
- Task 2 (web): device register/unregister — complete (12263b1, review clean)
- Task 3 (web): Expo push into notify() — complete (d38151d, review clean)
- Task 4 (web): rider privacy (split model) — complete (93ee555..5359b48, review clean after 2 fixes)
- Task 5 (web): mobile/config — complete (b3de7d4, review clean)
- Task 6 (web): FB/Messenger link — complete (5b660be, review clean)
- Task 7 (apps): monorepo + core skeleton — complete (a135793, review clean); CARRY: fix root tsc -b in Task 16; configure Metro monorepo in Task 12
- Task 8 (apps): api client + refresh — complete (f1daa5f..4ea3965, review clean; +regression tests for single-flight - Task 8 (apps): api client + refresh — pending deadlock guard)
- Task 9 (apps): auth + login (JWT decode) — complete (db39fe9, review clean). CARRY: add session-restore from stored token to useAuth in Task 12.
- Task 10 (apps): i18n/theme/config — complete (baa425a, review clean; real web palette)
- Task 11 (apps): push register — complete (52bc4b3, review clean). CORE PACKAGE COMPLETE (Tasks 7-11).
- Task 12 (apps): customer app + core session-restore — complete (52bc4b3..8ed3449, review clean +hardening). CARRY: Task16 fix core tsconfig types (48 test-file tsc errors) + root tsc -b. expo export android+ios verified.
- Task 13 (apps): rider app — complete (d6bb535, review clean). expo export android verified. NOTE: jest-expo/RTL flake under concurrent runs → CI should run per-workspace/serial (Task 16).
- Task 14 (apps): restaurant app — complete (57f141e, review clean). ALL 3 APPS SCAFFOLDED+BUNDLING. Partner splash currently #F7A81B → Task15 set turmeric #F4A62A.
- Task 15 (apps): branding — complete (912d481, review clean, pixel-verified per-app icons/splash)
- Task 16 (apps): EAS + CI + typecheck fixes — complete (c0de033, review clean). Root typecheck GREEN, tests 20/20 --runInBand.
- Task 17 (apps): CLAUDE.md + memory — complete (3dfff92 CLAUDE.md; memory files written by controller). ALL 17 TASKS + 6b DONE.

## Minor findings (for final review triage)
(none yet)

## Minor findings (final review triage) — updated
- [web] frontend `npm run build` currently fails on a PRE-EXISTING gap: leaflet/react-leaflet in package.json but missing from node_modules. Not caused by our changes (reproduced on unmodified tree). Fix: run `npm install` in frontend/ecommerce_inventory before building/deploying.
- [web] Instagram icon in StorefrontLayout still has no href (out of scope for Task 6).
- SP0 COMPLETE: web branch feature/mobile-enablers, commits fdf75dc..5b660be, food suite 339/339.

## Integration findings (discovered during Task 8 prep)
- Backend login is POST /api/auth/login/ (storefront), returns FLAT {access, refresh, message} — NO user object. role+username are JWT claims on the access token (issue_tokens in storefront/views.py). Task 9 login() must DECODE the JWT for role.
- No refresh endpoint existed; access token 60min / refresh 7day. Added Task 6b: POST /api/auth/refresh/ reusing issue_tokens (keeps claims, rotates refresh), whitelisted in PUBLIC_API_PREFIXES. Response shape {access, refresh, message} matches Task 8 client expectations.
- Task 6b (web): auth/refresh endpoint — complete (7173b78, review clean). Real path /api/store/auth/refresh/. Minor: inert /api/auth/refresh whitelist entry (harmless).

## FINAL WHOLE-BRANCH REVIEWS
- SP0 (web, opus): found CRITICAL — notify() did blocking Expo HTTP inside txns holding row locks. FIXED e5cdeb0 (transaction.on_commit; hide last-seen when not sharing; drop dead whitelist entry). 340 food tests green. Merge: READY.
- SP1 (apps, sonnet): found CRITICAL — auth primitives/push/version-gate built in core but NOT wired into app screens (no auth-gated routing → login unreachable on fresh install; rider/restaurant home no .catch → infinite spinner; registerForPush/fetchMobileConfig never called). FIXED ddd90e0.
- SP1 wiring re-review (ddd90e0): the first attempt was killed by a session limit; redone 2026-07-25. Verdict on the wiring itself: **Approved**.
  - Hooks order correct in all 3 apps (useAuth + all useState + all 3 useEffect run before any `return`/`<Redirect>`).
  - No redirect loop: Home `<Redirect href="/login" />` only when `role` null; `login.tsx` `router.replace('/')` after `signIn` sets role.
  - Data fetches gated on `role`, all three have `.catch()` (customer → empty list; rider/restaurant → error state).
  - Push + version gate both best-effort try/catch; a failure can't crash or block.
  - Pre-auth `fetchMobileConfig` is safe: `/api/food/` is in `PUBLIC_API_PREFIXES` (fabrythingweb `core/middleware.py:16`), so it can't 401 → clear tokens.
  - Dropping `extra.apiUrl` from the 3 `app.config.ts` is safe — dead config; the base URL comes from `packages/core/src/env.ts` (`EXPO_PUBLIC_API_URL`).
- **NEW FINDING (found by re-running, not in the fix report): CI was red as committed.** On a cold jest cache — which is every CI run, since the workflow does `npm ci` on a fresh checkout — the first react-native transform takes ~7s and blew jest's 5s default timeout, failing `customer › renders a restaurant from the API` (exit 1). Reproduces deterministically after `npx jest --clearCache`; invisible on a warm local cache, which is why the implementer's run was green.
  - FIX: `testTimeout: 30000` in the three apps' `jest.config.js`. **UNCOMMITTED.**
  - Verified: `npx jest --clearCache` then CI's exact `npm test --workspaces --if-present -- --runInBand` → 23/23 green, exit 0. Root `npm run typecheck` green.
- SP1 STATUS: complete pending commit of the jest-timeout fix.
