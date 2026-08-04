import { screen, waitFor } from '@testing-library/react-native';
import OrderDetailScreen from './[id]';
import { renderFlushed, pressFlushed } from '../../../src/test-utils';

const mockFetchOrderDetail = jest.fn();
const mockCancelOrder = jest.fn();
let mockAuthState: { role: string | null; loading: boolean };

const CANCELABLE_ORDER_STATUSES = ['PENDING_VERIFICATION', 'CONFIRMED', 'OUT_FOR_DELIVERY'];

class FakeStoreApiError extends Error {
  errors: string[];
  fieldErrors: Record<string, string[]>;
  constructor(message: string, errors: string[] = [], fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.errors = errors;
    this.fieldErrors = fieldErrors;
  }
}

jest.mock('../../../src/providers', () => ({ api: {} }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '7' }),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>redirect:{href}</Text>;
  },
}));
jest.mock('@fabrything/core', () => ({
  t: (k: string) => k,
  useAuth: () => mockAuthState,
  fetchOrderDetail: (...args: unknown[]) => mockFetchOrderDetail(...args),
  cancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
  CANCELABLE_ORDER_STATUSES,
}));

afterEach(() => {
  mockFetchOrderDetail.mockReset();
  mockCancelOrder.mockReset();
});

const baseOrder = {
  id: 7,
  order_number: 'ORD-0007',
  status: 'CONFIRMED',
  status_display: 'Confirmed',
  payment_method: 'COD',
  subtotal: '1998.00',
  shipping_amount: '60.00',
  total_amount: '2058.00',
  currency: 'BDT',
  contact_name: 'Karim',
  contact_phone: '01711112222',
  item_count: 2,
  created_at: '2026-08-01T10:00:00Z',
  shipping_address: {
    address_type: 'Home',
    address: '1 Test Rd',
    city: 'Dhaka',
    state: '',
    pincode: '',
    country: 'Bangladesh',
  },
  notes: '',
  canceled_reason: '',
  items: [
    {
      id: 1,
      product_name: 'Cotton Panjabi',
      product_slug: 'cotton-panjabi',
      product_image: null,
      sku: 'CP-M',
      size: 'M',
      color: 'White',
      unit_price: '999.00',
      quantity: 2,
      line_total: '1998.00',
    },
  ],
  status_logs: [
    { from_status: '', to_status: 'PENDING_VERIFICATION', reason: '', created_at: '2026-08-01T10:00:00Z' },
    { from_status: 'PENDING_VERIFICATION', to_status: 'CONFIRMED', reason: '', created_at: '2026-08-01T11:00:00Z' },
  ],
};

test('renders the order detail with a status timeline', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrderDetail.mockResolvedValue(baseOrder);
  await renderFlushed(<OrderDetailScreen />);

  await waitFor(() => expect(screen.getByText('ORD-0007')).toBeTruthy());
  expect(screen.getByText('Cotton Panjabi (M)', { exact: false })).toBeTruthy();
  expect(screen.getByText('PENDING_VERIFICATION')).toBeTruthy();
  expect(screen.getByText('CONFIRMED')).toBeTruthy();
  expect(screen.getByText('cancelOrder')).toBeTruthy();
});

test('a non-cancelable status shows the not-cancelable message instead of a button', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrderDetail.mockResolvedValue({ ...baseOrder, status: 'DELIVERED', status_display: 'Delivered' });
  await renderFlushed(<OrderDetailScreen />);

  await waitFor(() => expect(screen.getByText('ORD-0007')).toBeTruthy());
  expect(screen.getByText('orderNotCancelable')).toBeTruthy();
  expect(screen.queryByText('cancelOrder')).toBeNull();
});

test('cancel succeeds and reloads the order', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrderDetail
    .mockResolvedValueOnce(baseOrder)
    .mockResolvedValueOnce({ ...baseOrder, status: 'CANCELED', status_display: 'Canceled', canceled_reason: 'Canceled by customer' });
  mockCancelOrder.mockResolvedValue({ status: 'CANCELED' });

  await renderFlushed(<OrderDetailScreen />);
  await waitFor(() => expect(screen.getByText('cancelOrder')).toBeTruthy());

  await pressFlushed(screen.getByText('cancelOrder'));

  await waitFor(() => expect(screen.getByText('Canceled by customer')).toBeTruthy());
  expect(mockCancelOrder).toHaveBeenCalledWith({}, '7');
  expect(mockFetchOrderDetail).toHaveBeenCalledTimes(2);
});

test('a rejected cancel on a non-cancellable order shows a clear message', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrderDetail.mockResolvedValue(baseOrder);
  mockCancelOrder.mockRejectedValue(new FakeStoreApiError('Not allowed', ['This order can no longer be canceled']));

  await renderFlushed(<OrderDetailScreen />);
  await waitFor(() => expect(screen.getByText('cancelOrder')).toBeTruthy());

  await pressFlushed(screen.getByText('cancelOrder'));

  await waitFor(() => expect(screen.getByText('This order can no longer be canceled')).toBeTruthy());
  // The order is not silently marked canceled on a failed attempt.
  expect(screen.getByText('Confirmed')).toBeTruthy();
});

test('redirects to login when signed out', async () => {
  mockAuthState = { role: null, loading: false };
  await renderFlushed(<OrderDetailScreen />);
  await waitFor(() => expect(screen.getByText('redirect:/login')).toBeTruthy());
  expect(mockFetchOrderDetail).not.toHaveBeenCalled();
});
