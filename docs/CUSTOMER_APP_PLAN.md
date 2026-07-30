# Customer app build plan — resumable

**This file plus `docs/CUSTOMER_APP_LEDGER.md` is the handoff.** Any fresh
session, or a scheduled agent, resumes by reading these two files and `git log`.
No conversation history is required.

**Protocol on resume:** read the ledger, find the first task without a
`complete` line, and start it. Trust the ledger and `git log` over any
recollection. Commit after every task.

Backend API base: `https://fabrythingweb.onrender.com/api/` — the sibling repo
`../fabrythingweb` is the contract. ~936 backend tests green. Endpoints below
were built and tested there; **read the Django view before guessing a shape.**

## Ground rules

- **TDD.** Every task starts with a failing test. `jest-expo` preset, tests
  beside sources. Jest pinned to `^29` (jest-expo 57 requires it).
- **Shared logic goes in `packages/core`**, apps stay thin. That is the golden
  rule in `CLAUDE.md` — a screen is glue: it calls `api` from its own
  `src/providers.tsx` and pulls copy from core's i18n.
- **Never hardcode English** — use core's `t()`/`strings` (en/bn).
- Run only the workspace you touched while iterating:
  `npm --workspace @fabrything/core test` or `@fabrything/customer`.
  Full check before pushing: `npm run typecheck` then
  `npm test --workspaces --if-present -- --runInBand`.
- Commit after each task. An interrupted session must lose at most one task.

## API facts already verified (do not re-derive)

- Login is `store/auth/login/`, response is **FLAT** `{access, refresh, message}`.
  `role`/`username` are **JWT claims**, decoded client-side. No `/me`, no nested
  user object. Refresh is `store/auth/refresh/`.
- Two list envelopes exist. `storefront` list endpoints return **nested**
  `{data: {data: [...], totalPages, totalItems, currentPage}}`. Others return
  flat `{data: [...]}`. Check which before parsing — this has broken pages
  before.
- Errors return `{errors, field_errors, message}`, not `{data}`.
- Product images are absolute URLs already (fixed server-side); some are
  `/api/media/<sha>/` served from the API host.
- `?ordering=` accepts `newest|price_low|price_high|name`; an invalid value is
  ignored (not a 500 — that was fixed).
- Category filtering descends the whole subtree; an unknown slug returns empty.

## Tasks

### Task 1 — core: store API surface + types
`packages/core/src/store/` — typed client functions and TS types for:
categories (`store/categories/`), product list (`store/products/` with
`category`, `search`, `ordering`, `page`, `pageSize`), product detail
(`store/products/<slug>/`), store config (`store/config/`).
Handle the nested list envelope in one place so screens never see it.
Export from `packages/core/src/index.ts`.
Tests: envelope unwrapping, query building, error shape mapping.

### Task 2 — customer app: store browsing
Routes under `apps/customer/app/`: a store home listing categories, a category
/ product-list screen with search + sort + pagination, and a product detail
screen (gallery, price, discount, sizes, stock, shipping note, Rx flag).
Tests: renders products from a mocked core client; empty state; error state.

### Task 3 — core: cart
`packages/core/src/cart/` — local cart state (add/remove/update qty/clear) with
`expo-secure-store` or AsyncStorage persistence, variant-aware (checkout charges
`ProductVariant.effective_price`, so a cart line is a **variant**, not a
product). Server cart endpoints exist (`store/cart/`, `store/cart/merge/`) —
merge local into server on login.
Tests: totals, variant identity, persistence round-trip, merge-on-login.

### Task 4 — customer app: cart + checkout (+ wire navigation)

**Navigation gap left by Task 2:** the store screens live under `/store/*` but
nothing links to them — the app still opens on the food-oriented `index.tsx`, so
they are unreachable. Fix that as part of this task: give the app a real entry
point that reaches both the store and the existing food surface.

Cart screen and a COD checkout flow (address, contact, place order via
`store/orders/`). Surface `field_errors` against the right input. Shipping is
resolved server-side (`max(flat rate, per-product fees)`, free-shipping promos)
— **display what the server returns, never recompute it client-side.**
Tests: quantity edit, empty cart, validation errors shown, successful placement.

### Task 5 — customer app: order history + tracking
`store/orders/list/`, `store/orders/<pk>/`, cancel via
`store/orders/<pk>/cancel/`. Show status timeline.
Tests: list renders, detail renders, cancel path.

### Task 6 — CI/CD
Extend `.github/workflows/mobile-ci.yml`: keep typecheck + tests on every PR,
add an EAS build job **gated behind repository secrets existing** (so it stays a
no-op until the owner's Expo/Apple/Google accounts are created this week).
See `docs/RELEASE.md` for the one-time account setup.

### Task 7 — polish pass
Loading skeletons, pull-to-refresh, offline/error handling, bn translations for
all new copy, and a11y labels.
