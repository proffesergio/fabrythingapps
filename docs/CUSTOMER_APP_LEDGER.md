# Customer app ledger — plan: docs/CUSTOMER_APP_PLAN.md

Append one line per event. **A task is done only when it has a `complete` line.**
On resume: first task without `complete` is the next one to do.

Baseline before Task 1: customer app = 4 files (login + one restaurant list
screen). `packages/core` has api/auth/config/i18n/theme, no store/cart/orders.
Branch: `feat/customer-app-store`.

- 2026-07-30: plan + ledger created. Next: Task 1 (core store API surface).
- 2026-07-30: Task 1 complete (commit 8aa1632) — packages/core/src/store/ (categories, products, product detail, config) with nested-envelope unwrapping, query builder, and StoreApiError; core tests 31/31, full typecheck clean. Next: Task 2 (store browsing screens).
- 2026-07-30: Task 2 complete (commit 2e81877) — apps/customer/app/store/ (categories home, product-list with search/sort/pagination, product detail) as thin screens over Task 1's core client; Rx products flagged not hidden; en/bn copy added. Full suite green: core 31/31, customer 15/15, restaurant 2/2, rider 2/2; typecheck clean across all workspaces. Next: Task 3 (core: cart).
- 2026-07-30: Task 3 complete (commit e34f974) — packages/core/src/cart/ (variant-keyed local cart with expo-secure-store persistence via a CartProvider, pure cartLogic for add/update/remove/totals, mergeCartOnLogin for guest->server cart merge on sign-in) and packages/core/src/orders/ (placeOrder posting store/orders/, returning shipping_amount/total_amount verbatim; isRxBlockedError to detect the Rx-disabled rejection by its fixed backend phrase). No new dependency added — reused expo-secure-store. Core suite: 16 suites/58 tests green; full-workspace typecheck clean. Next: Task 4 (cart + checkout screens, wire navigation).
- 2026-07-30: Task 4 complete (commit d204a9d) — apps/customer/app/store/cart.tsx and checkout.tsx (address+contact COD checkout via store/orders/, field_errors shown per-input, Rx-disabled rejection shown via isRxBlockedError instead of a generic failure); product detail now offers variant selection + Add to Cart via core's useCart(). Navigation gap closed: app/index.tsx is a real entry point reaching /store (no forced login, store browsing is public) and /food (old screen moved there unchanged); a CartHeaderButton in _layout.tsx surfaces the cart everywhere. Cart screen shows subtotal only pre-checkout (no shipping-quote endpoint exists server-side — showing a number would be a guess) and the checkout success view shows shipping_amount/total_amount exactly as the server returned them. Customer suite 7/29 green; full workspace (core 58, customer 29, restaurant 2, rider 2) green, typecheck clean. Next: Task 5 (order history + tracking).
- 2026-07-30: Tasks 1-4 merged to main and pushed. Full workspace green (core 58, customer 29, restaurant 2, rider 2), typecheck clean.
  OPEN ISSUE A: no pre-checkout shipping preview — backend `shipping_for` runs only inside `place_cod_order`, so the cart shows subtotal + "calculated at checkout". Needs a new backend quote endpoint in ../fabrythingweb to fix properly.
  OPEN ISSUE B: `isRxBlockedError` matches the backend's English message string — brittle. Should be a stable error code from the server instead.
  Next: Task 5 (order history + tracking), then Task 6 (CI/CD gated on Expo/Apple/Google secrets), Task 7 (polish).
