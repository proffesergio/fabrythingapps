import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import OrderList from './index';

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
  t: (k: string) => k,
  useAuth: () => mockAuthState,
  fetchOrders: (...args: unknown[]) => mockFetchOrders(...args),
}));

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
  await render(<OrderList />);
  await waitFor(() => expect(screen.getByText('ORD-0007')).toBeTruthy());
  expect(screen.getByText('Confirmed')).toBeTruthy();
  expect(screen.getByText(/2058.00/)).toBeTruthy();
});

test('navigates to order detail on press', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrders.mockResolvedValue({ items: [sampleOrder], totalPages: 1, totalItems: 1, currentPage: 1, pageSize: 20 });
  await render(<OrderList />);
  const row = await screen.findByText('ORD-0007');
  fireEvent.press(row);
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/store/orders/[id]', params: { id: '7' } });
});

test('shows an empty state when there are no orders', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrders.mockResolvedValue({ items: [], totalPages: 1, totalItems: 0, currentPage: 1, pageSize: 20 });
  await render(<OrderList />);
  await waitFor(() => expect(screen.getByText('noOrders')).toBeTruthy());
});

test('shows an error state with a retry action', async () => {
  mockAuthState = { role: 'Customer', loading: false };
  mockFetchOrders.mockRejectedValue(new Error('Network down'));
  await render(<OrderList />);
  await waitFor(() => expect(screen.getByText('Network down')).toBeTruthy());
  expect(screen.getByText('retry')).toBeTruthy();
});

test('redirects to login when signed out', async () => {
  mockAuthState = { role: null, loading: false };
  await render(<OrderList />);
  await waitFor(() => expect(screen.getByText('redirect:/login')).toBeTruthy());
  expect(mockFetchOrders).not.toHaveBeenCalled();
});
