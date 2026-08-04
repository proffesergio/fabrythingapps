import { screen, waitFor } from '@testing-library/react-native';
import Checkout from './checkout';
import { renderFlushed, pressFlushed } from '../../src/test-utils';

const mockPush = jest.fn();
const mockPlaceOrder = jest.fn();
const mockClear = jest.fn();
const mockIsRxBlockedError = jest.fn();
// Controls the fake `useSlowRequestHint` below -- the hook's own delay
// timing is unit-tested in core (`slowRequestHint.test.tsx`); this file only
// needs to check that checkout.tsx wires `submitting` into it and renders
// the hint when it flips true, without waiting out a real multi-second delay.
let mockSlow = false;

class FakeStoreApiError extends Error {
  errors: string[];
  fieldErrors: Record<string, string[]>;
  status?: number;
  constructor(message: string, errors: string[] = [], fieldErrors: Record<string, string[]> = {}, status?: number) {
    super(message);
    this.errors = errors;
    this.fieldErrors = fieldErrors;
    this.status = status;
  }
}

const line = {
  variantId: 11,
  productId: 1,
  productSlug: 'cotton-panjabi',
  productName: 'Cotton Panjabi',
  sku: 'CP-M',
  size: 'M',
  color: 'White',
  unitPrice: '999.00',
  quantity: 2,
  stockQuantity: 5,
  requiresPrescription: false,
  image: null,
};

jest.mock('../../src/providers', () => ({ api: {} }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@fabrything/core', () => ({
  ...jest.requireActual('@fabrything/core'),
  t: (k: string) => k,
  placeOrder: (...args: unknown[]) => mockPlaceOrder(...args),
  isRxBlockedError: (...args: unknown[]) => mockIsRxBlockedError(...args),
  useCart: () => ({ lines: [line], clear: mockClear }),
  useSlowRequestHint: (loading: boolean) => loading && mockSlow,
}));

afterEach(() => {
  mockPush.mockReset();
  mockPlaceOrder.mockReset();
  mockClear.mockReset();
  mockIsRxBlockedError.mockReset().mockReturnValue(false);
  mockSlow = false;
});

test('successful order placement shows the server-resolved shipping and total verbatim', async () => {
  mockPlaceOrder.mockResolvedValue({
    order_id: 42,
    order_number: 'ORD-0042',
    subtotal: 1998,
    shipping_amount: 60,
    total_amount: 2058,
    currency: 'BDT',
    status: 'PLACED',
  });

  await renderFlushed(<Checkout />);
  await pressFlushed(screen.getByText('placeOrder'));

  await waitFor(() => expect(screen.getByText('orderPlaced')).toBeTruthy());
  expect(screen.getByText(/ORD-0042/)).toBeTruthy();
  expect(screen.getByText(/60/)).toBeTruthy();
  expect(screen.getByText(/2058/)).toBeTruthy();
  expect(mockClear).toHaveBeenCalled();
});

test('field validation errors are rendered against the right input', async () => {
  mockPlaceOrder.mockRejectedValue(
    new FakeStoreApiError('Validation error', ['Enter a valid phone number.'], {
      contact_phone: ['Enter a valid phone number.'],
    }),
  );

  await renderFlushed(<Checkout />);
  await pressFlushed(screen.getByText('placeOrder'));

  await waitFor(() => expect(screen.getByText('Enter a valid phone number.')).toBeTruthy());
  // Not shown as a generic banner-only message with no field context.
  expect(screen.queryByText('orderPlaced')).toBeNull();
});

test('an Rx-blocked rejection shows a clear message instead of a generic failure', async () => {
  mockPlaceOrder.mockRejectedValue(new FakeStoreApiError('Could not place order', ['X requires a prescription and is not yet available for online purchase.']));
  mockIsRxBlockedError.mockReturnValue(true);

  await renderFlushed(<Checkout />);
  await pressFlushed(screen.getByText('placeOrder'));

  await waitFor(() => expect(screen.getByText('rxBlocked')).toBeTruthy());
});

test('a generic failure with no field_errors shows a fallback message', async () => {
  mockPlaceOrder.mockRejectedValue(
    new FakeStoreApiError('Could not place order', ['Only 1 left of Cotton Panjabi (M).'], {}, 409),
  );
  mockIsRxBlockedError.mockReturnValue(false);

  await renderFlushed(<Checkout />);
  await pressFlushed(screen.getByText('placeOrder'));

  await waitFor(() => expect(screen.getByText('Only 1 left of Cotton Panjabi (M).')).toBeTruthy());
});

test('a real network failure (no HTTP response at all) shows the offline hint, not a raw axios message', async () => {
  mockPlaceOrder.mockRejectedValue(new FakeStoreApiError('Network Error'));
  mockIsRxBlockedError.mockReturnValue(false);

  await renderFlushed(<Checkout />);
  await pressFlushed(screen.getByText('placeOrder'));

  await waitFor(() => expect(screen.getByText('offline')).toBeTruthy());
});

test('a slow-to-resolve placement shows the slow-request hint instead of an indefinite spinner', async () => {
  mockSlow = true;
  let resolveOrder!: (value: unknown) => void;
  mockPlaceOrder.mockReturnValue(new Promise((resolve) => { resolveOrder = resolve; }));

  await renderFlushed(<Checkout />);
  await pressFlushed(screen.getByText('placeOrder'));

  expect(screen.getByText('slowRequestHint')).toBeTruthy();

  // Resolve so the pending promise doesn't leak into the next test.
  resolveOrder({
    order_number: 'ORD-0042',
    subtotal: 1998,
    shipping_amount: 60,
    total_amount: 2058,
    currency: 'BDT',
  });
  await waitFor(() => expect(screen.getByText('orderPlaced')).toBeTruthy());
});

test('the slow-request hint is not shown while a request is not actually slow', async () => {
  mockSlow = false;
  mockPlaceOrder.mockResolvedValue({
    order_number: 'ORD-0042',
    subtotal: 1998,
    shipping_amount: 60,
    total_amount: 2058,
    currency: 'BDT',
  });

  await renderFlushed(<Checkout />);
  await pressFlushed(screen.getByText('placeOrder'));

  await waitFor(() => expect(screen.getByText('orderPlaced')).toBeTruthy());
  expect(screen.queryByText('slowRequestHint')).toBeNull();
});
