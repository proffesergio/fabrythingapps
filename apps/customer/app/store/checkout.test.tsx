import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import Checkout from './checkout';

const mockPush = jest.fn();
const mockPlaceOrder = jest.fn();
const mockClear = jest.fn();
const mockIsRxBlockedError = jest.fn();

class FakeStoreApiError extends Error {
  errors: string[];
  fieldErrors: Record<string, string[]>;
  constructor(message: string, errors: string[] = [], fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.errors = errors;
    this.fieldErrors = fieldErrors;
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
  t: (k: string) => k,
  placeOrder: (...args: unknown[]) => mockPlaceOrder(...args),
  isRxBlockedError: (...args: unknown[]) => mockIsRxBlockedError(...args),
  useCart: () => ({ lines: [line], clear: mockClear }),
}));

afterEach(() => {
  mockPush.mockReset();
  mockPlaceOrder.mockReset();
  mockClear.mockReset();
  mockIsRxBlockedError.mockReset().mockReturnValue(false);
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

  await render(<Checkout />);
  fireEvent.press(screen.getByText('placeOrder'));

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

  await render(<Checkout />);
  fireEvent.press(screen.getByText('placeOrder'));

  await waitFor(() => expect(screen.getByText('Enter a valid phone number.')).toBeTruthy());
  // Not shown as a generic banner-only message with no field context.
  expect(screen.queryByText('orderPlaced')).toBeNull();
});

test('an Rx-blocked rejection shows a clear message instead of a generic failure', async () => {
  mockPlaceOrder.mockRejectedValue(new FakeStoreApiError('Could not place order', ['X requires a prescription and is not yet available for online purchase.']));
  mockIsRxBlockedError.mockReturnValue(true);

  await render(<Checkout />);
  fireEvent.press(screen.getByText('placeOrder'));

  await waitFor(() => expect(screen.getByText('rxBlocked')).toBeTruthy());
});

test('a generic failure with no field_errors shows a fallback message', async () => {
  mockPlaceOrder.mockRejectedValue(new FakeStoreApiError('Could not place order', ['Only 1 left of Cotton Panjabi (M).']));
  mockIsRxBlockedError.mockReturnValue(false);

  await render(<Checkout />);
  fireEvent.press(screen.getByText('placeOrder'));

  await waitFor(() => expect(screen.getByText('Only 1 left of Cotton Panjabi (M).')).toBeTruthy());
});
