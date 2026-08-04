// React 18+ requires the test host to opt in to "act environment" support
// by setting this global -- see
// https://github.com/reactwg/react-18/discussions/102. `@testing-library/*`
// packages set it for you automatically; this package renders trees
// directly with `react-test-renderer` in a few tests (useAuth, CartProvider)
// with no such wrapper, so without this every effect-driven state update
// logs "The current testing environment is not configured to support
// act(...)" regardless of how carefully the test awaits things.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
