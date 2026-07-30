# Customer app ledger — plan: docs/CUSTOMER_APP_PLAN.md

Append one line per event. **A task is done only when it has a `complete` line.**
On resume: first task without `complete` is the next one to do.

Baseline before Task 1: customer app = 4 files (login + one restaurant list
screen). `packages/core` has api/auth/config/i18n/theme, no store/cart/orders.
Branch: `feat/customer-app-store`.

- 2026-07-30: plan + ledger created. Next: Task 1 (core store API surface).
- 2026-07-30: Task 1 complete (commit 8aa1632) — packages/core/src/store/ (categories, products, product detail, config) with nested-envelope unwrapping, query builder, and StoreApiError; core tests 31/31, full typecheck clean. Next: Task 2 (store browsing screens).
