# Customer app ledger — plan: docs/CUSTOMER_APP_PLAN.md

Append one line per event. **A task is done only when it has a `complete` line.**
On resume: first task without `complete` is the next one to do.

Baseline before Task 1: customer app = 4 files (login + one restaurant list
screen). `packages/core` has api/auth/config/i18n/theme, no store/cart/orders.
Branch: `feat/customer-app-store`.

- 2026-07-30: plan + ledger created. Next: Task 1 (core store API surface).
- 2026-07-30: Task 1 complete (commit 8aa1632) — packages/core/src/store/ (categories, products, product detail, config) with nested-envelope unwrapping, query builder, and StoreApiError; core tests 31/31, full typecheck clean. Next: Task 2 (store browsing screens).
- 2026-07-30: Task 2 complete (commit 2e81877) — apps/customer/app/store/ (categories home, product-list with search/sort/pagination, product detail) as thin screens over Task 1's core client; Rx products flagged not hidden; en/bn copy added. Full suite green: core 31/31, customer 15/15, restaurant 2/2, rider 2/2; typecheck clean across all workspaces. Next: Task 3 (core: cart).
- 2026-07-30: Task 3 complete (commit e34f974) — packages/core/src/cart/ (variant-keyed local cart with expo-secure-store persistence via a CartProvider, pure cartLogic for add/update/remove/totals, mergeCartOnLogin for guest->server cart merge on sign-in) and packages/core/src/orders/ (placeOrder posting store/orders/, returning shipping_amount/total_amount verbatim; isRxBlockedError to detect the Rx-disabled rejection by its fixed backend phrase). No new dependency added — reused expo-secure-store. Core suite: 16 suites/74 tests green; full-workspace typecheck clean. Next: Task 4 (cart + checkout screens, wire navigation).
