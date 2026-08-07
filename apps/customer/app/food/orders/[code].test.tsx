import { cleanup, screen, waitFor } from '@testing-library/react-native';
import { renderFlushed } from '../../../src/test-utils';

const mockTrack = jest.fn();

jest.mock('../../../src/providers', () => ({ api: {} }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ code: 'FD-123', phone: '8801842168117' }),
}));
jest.mock('@fabrything/core', () => ({
  t: (k: string) => k,
  theme: { light: { text: '#000', muted: '#888', line: '#eee', surface: '#fff', primary: '#E8452B', primaryDeep: '#B3261E' } },
  trackFoodOrder: (...a: unknown[]) => mockTrack(...a),
  useSlowRequestHint: () => false,
}));

import TrackFoodOrder from './[code]';

const order = {
  id: 1, order_code: 'FD-123', status: 'PREPARING',
  restaurant_name: 'Rahim Hotel', delivery_address: 'Ujanchar',
  subtotal: '200.00', discount: '0.00', delivery_fee: '40.00', tip: '0.00', total: '240.00',
  eta_minutes: 35, payment_method: 'COD', rider_name: null, rider_phone: null,
  items: [{ id: 1, item_name: 'Naan', quantity: 2, line_total: '200.00', unit_price: '100.00', selected_options: [] }],
};

afterEach(cleanup);

beforeEach(() => {
  mockTrack.mockReset().mockResolvedValue(order);
});

test('passes the guest phone so an unauthenticated customer can track', async () => {
  // The track view 404s a guest whose ?phone= does not match guest_phone, so
  // dropping it would make every guest order untrackable.
  await renderFlushed(<TrackFoodOrder />);
  await waitFor(() => expect(mockTrack).toHaveBeenCalledWith({}, 'FD-123', '8801842168117'));
});

test('marks progress up to the current status and no further', async () => {
  await renderFlushed(<TrackFoodOrder />);
  await waitFor(() => expect(screen.getByLabelText('done-PREPARING')).toBeTruthy());
  expect(screen.getByLabelText('done-PLACED')).toBeTruthy();
  expect(screen.getByLabelText('done-CONFIRMED')).toBeTruthy();
  // Not yet reached — showing these as done would misreport where the food is.
  expect(screen.getByLabelText('pending-OUT_FOR_DELIVERY')).toBeTruthy();
  expect(screen.getByLabelText('pending-DELIVERED')).toBeTruthy();
});

test('shows the rider once one is assigned', async () => {
  mockTrack.mockResolvedValue({ ...order, status: 'OUT_FOR_DELIVERY', rider_name: 'Karim', rider_phone: '8801700000000' });
  await renderFlushed(<TrackFoodOrder />);
  await waitFor(() => expect(screen.getByText('Karim')).toBeTruthy());
  expect(screen.getByText('callRider')).toBeTruthy();
});

test('renders a cancelled order as cancelled, not as a stalled progress bar', async () => {
  mockTrack.mockResolvedValue({ ...order, status: 'CANCELLED' });
  await renderFlushed(<TrackFoodOrder />);
  await waitFor(() => expect(screen.getByText('orderCanceled')).toBeTruthy());
  expect(screen.queryByLabelText('done-PLACED')).toBeNull();
});

test('shows the money breakdown the customer will pay in cash', async () => {
  await renderFlushed(<TrackFoodOrder />);
  await waitFor(() => expect(screen.getByText('৳240.00')).toBeTruthy());
  expect(screen.getByText('৳40.00')).toBeTruthy();
});
