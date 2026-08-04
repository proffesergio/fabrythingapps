import { act, screen, waitFor } from '@testing-library/react-native';
import OrderList from './index';
import { renderFlushed, pressFlushed } from '../../../src/test-utils';

const mockFetchOrders = jest.fn();
const mockPush = jest.fn();
let mockAuthState: { role: string | null; loading: boolean };

jest.mock('../../../src/providers', () => ({ api: {} }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>redirect:{href}</Text>;
  },
}));
jest.mock('@fabrything/core', () => ({
  ...jest.requireActual('@fabrything/core'),
  t: (k: string) => k,
  useAuth: () => mockAuthState,
  fetchOrders: (...args: unknown[]) => mockFetchOrders(...args),
}));

class FakeStoreApiError extends Error {
  errors: string[];
  status?: number;
  constructor(message: string, errors: string[] = [], status?: number) {
    super(message);
    this.errors = errors;
    this.status = status;
  }
}

afterEach(() => {
  mockFetchOrders.mockReset();
  mockPush.mockReset();
});

const sampleOrder = {
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
};

test('renders orders from the mocked client', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrders.mockResolvedValue({ items: [sampleOrder], totalPages: 1, totalItems: 1, currentPage: 1, pageSize: 20 });
  await renderFlushed(<OrderList />);
  await waitFor(() => expect(screen.getByText('ORD-0007')).toBeTruthy());
  expect(screen.getByText('Confirmed')).toBeTruthy();
  expect(screen.getByText(/2058.00/)).toBeTruthy();
});

test('navigates to order detail on press', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrders.mockResolvedValue({ items: [sampleOrder], totalPages: 1, totalItems: 1, currentPage: 1, pageSize: 20 });
  await renderFlushed(<OrderList />);
  const row = await screen.findByText('ORD-0007');
  await pressFlushed(row);
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/store/orders/[id]', params: { id: '7' } });
});

test('shows an empty state when there are no orders', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrders.mockResolvedValue({ items: [], totalPages: 1, totalItems: 0, currentPage: 1, pageSize: 20 });
  await renderFlushed(<OrderList />);
  await waitFor(() => expect(screen.getByText('noOrders')).toBeTruthy());
});

test('shows an error state with a retry action', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrders.mockRejectedValue(new FakeStoreApiError('Server error', ['Server error'], 500));
  await renderFlushed(<OrderList />);
  await waitFor(() => expect(screen.getByText('Server error')).toBeTruthy());
  expect(screen.getByText('retry')).toBeTruthy();
});

test('shows an offline hint when the request never reaches the server', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrders.mockRejectedValue(new FakeStoreApiError('Network Error', []));
  await renderFlushed(<OrderList />);
  await waitFor(() => expect(screen.getByText('offline')).toBeTruthy());
});

test('retry re-fetches and clears the error state on success', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrders.mockRejectedValueOnce(new FakeStoreApiError('Server error', ['Server error'], 500));
  await renderFlushed(<OrderList />);
  await waitFor(() => expect(screen.getByText('Server error')).toBeTruthy());

  mockFetchOrders.mockResolvedValueOnce({ items: [sampleOrder], totalPages: 1, totalItems: 1, currentPage: 1, pageSize: 20 });
  await pressFlushed(screen.getByText('retry'));
  await waitFor(() => expect(screen.getByText('ORD-0007')).toBeTruthy());
});

test('pull-to-refresh re-fetches the order list', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrders.mockResolvedValueOnce({ items: [sampleOrder], totalPages: 1, totalItems: 1, currentPage: 1, pageSize: 20 });
  await renderFlushed(<OrderList />);
  await waitFor(() => expect(screen.getByText('ORD-0007')).toBeTruthy());

  mockFetchOrders.mockResolvedValueOnce({
    items: [{ ...sampleOrder, id: 9, order_number: 'ORD-0009' }],
    totalPages: 1,
    totalItems: 1,
    currentPage: 1,
    pageSize: 20,
  });
  const list = screen.getByTestId('order-list');
  await act(async () => {
    list.props.refreshControl.props.onRefresh();
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
  await waitFor(() => expect(screen.getByText('ORD-0009')).toBeTruthy());
});

test('redirects to login when signed out', async () => {
  mockAuthState = { role: null, loading: false };
  await renderFlushed(<OrderList />);
  await waitFor(() => expect(screen.getByText('redirect:/login')).toBeTruthy());
  expect(mockFetchOrders).not.toHaveBeenCalled();
});
