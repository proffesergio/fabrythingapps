import { screen, waitFor } from '@testing-library/react-native';
import { renderFlushed, pressFlushed } from '../src/test-utils';
import OrdersScreen from './orders';

jest.mock('../src/providers', () => ({ api: {} }));

const mockFetch = jest.fn();
const mockSetStatus = jest.fn();

jest.mock('@fabrything/core', () => {
  const actual = jest.requireActual('@fabrything/core');
  return {
    ...actual,
    fetchVendorOrders: (...a: any[]) => mockFetch(...a),
    setVendorOrderStatus: (...a: any[]) => mockSetStatus(...a),
  };
});

const placed = {
  id: 1, order_code: 'A1', status: 'PLACED', contact_name: 'Rahim',
  contact_phone: '0180', total: '540.00', payment_method: 'COD',
  items: [{ name: 'Kacchi', quantity: 2 }],
};
const preparing = { id: 2, order_code: 'B2', status: 'PREPARING', total: '300.00', payment_method: 'COD' };

afterEach(() => jest.clearAllMocks());

test('empty state when there are no orders', async () => {
  mockFetch.mockResolvedValue([]);
  await renderFlushed(<OrdersScreen />);
  expect(await screen.findByText(/No orders right now/i)).toBeTruthy();
});

test('renders order details and items', async () => {
  mockFetch.mockResolvedValue([placed]);
  await renderFlushed(<OrdersScreen />);
  expect(await screen.findByText('#A1')).toBeTruthy();
  expect(screen.getByText('2 × Kacchi')).toBeTruthy();
  expect(screen.getByText(/Awaiting rider/i)).toBeTruthy();
});

// The button offered must match the server's allowed transition, never a guess.
test('offers Accept order for PLACED and Ready for pickup for PREPARING', async () => {
  mockFetch.mockResolvedValue([placed, preparing]);
  await renderFlushed(<OrdersScreen />);
  expect(await screen.findByLabelText('Accept order')).toBeTruthy();
  expect(screen.getByLabelText('Ready for pickup')).toBeTruthy();
});

test('advancing a PLACED order sends CONFIRMED', async () => {
  mockFetch.mockResolvedValue([placed]);
  mockSetStatus.mockResolvedValue({ ...placed, status: 'CONFIRMED' });
  await renderFlushed(<OrdersScreen />);
  const btn = await screen.findByLabelText('Accept order');
  await pressFlushed(btn);
  await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith({}, 1, 'CONFIRMED'));
});

// The server owns the state machine; a rejection must surface its reason
// rather than the card silently moving on.
test('a rejected transition shows the server reason', async () => {
  mockFetch.mockResolvedValue([placed]);
  const err: any = new Error('Invalid transition');
  err.errors = ['PLACED -> DELIVERED not allowed'];
  err.status = 400;
  mockSetStatus.mockRejectedValue(err);
  await renderFlushed(<OrdersScreen />);
  const btn = await screen.findByLabelText('Accept order');
  await pressFlushed(btn);
  expect(await screen.findByText(/not allowed/i)).toBeTruthy();
});

test('new PLACED orders sort above in-progress ones', async () => {
  mockFetch.mockResolvedValue([preparing, placed]);
  await renderFlushed(<OrdersScreen />);
  await screen.findByText('#A1');
  const codes = screen.getAllByText(/^#/).map((n) => n.props.children.join(''));
  expect(codes[0]).toBe('#A1');
});
