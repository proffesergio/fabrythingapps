import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderFlushed, pressFlushed } from '../../src/test-utils';

// Every interaction must be awaited inside its own act() scope. A bare
// synchronous fireEvent while this screen's quote/restaurant promises are
// still settling produces "overlapping act() calls", which wedges React's act
// stack for the REST of the file — later tests then render nothing at all.
const flush = () => new Promise<void>((r) => setImmediate(() => r()));
async function changeTextFlushed(el: unknown, value: string) {
  await act(async () => {
    fireEvent.changeText(el as never, value);
    await flush();
  });
}

const mockFetchRestaurant = jest.fn();
const mockFetchZones = jest.fn();
const mockQuote = jest.fn();
const mockPlace = jest.fn();
const mockValidateCoupon = jest.fn();
const mockClear = jest.fn();
const mockReplace = jest.fn();

let mockCartLines = [{ itemId: 11, restaurantSlug: 'rahim', name: 'Naan', image: null, unitPrice: '100.00', optionIds: [], optionLabels: [], quantity: 2 }];

jest.mock('../../src/providers', () => ({ api: {} }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
jest.mock('@fabrything/core', () => ({
  t: (k: string) => k,
  theme: { light: { text: '#000', muted: '#888', line: '#eee', surface: '#fff', primary: '#E8452B', primaryDeep: '#B3261E' } },
  fetchRestaurant: (...a: unknown[]) => mockFetchRestaurant(...a),
  fetchZones: (...a: unknown[]) => mockFetchZones(...a),
  fetchDeliveryQuote: (...a: unknown[]) => mockQuote(...a),
  placeFoodOrder: (...a: unknown[]) => mockPlace(...a),
  validateCoupon: (...a: unknown[]) => mockValidateCoupon(...a),
  toOrderItems: (lines: any[]) => lines.map((l) => ({ item_id: l.itemId, quantity: l.quantity, option_ids: l.optionIds })),
  useFoodCart: () => ({
    lines: mockCartLines,
    restaurantSlug: mockCartLines.length ? mockCartLines[0].restaurantSlug : null,
    totals: { itemCount: 2, subtotal: 200 },
    clear: mockClear,
  }),
  useSlowRequestHint: () => false,
}));

import FoodCheckout from './checkout';

const restaurant = {
  id: 1, name: 'Rahim Hotel', display_name: 'Rahim Hotel', slug: 'rahim',
  min_order_amount: '150.00', is_open_now: true, is_accepting_orders: true,
  served_zone_ids: [1], categories: [],
};

const zones = [
  { id: 1, name: 'Bancharampur Sadar', name_bn: '', villages: [{ id: 9, name: 'Ujanchar', name_bn: '' }] },
  { id: 2, name: 'Not Served', name_bn: '', villages: [] },
];

afterEach(cleanup);

beforeEach(() => {
  mockCartLines = [{ itemId: 11, restaurantSlug: 'rahim', name: 'Naan', image: null, unitPrice: '100.00', optionIds: [], optionLabels: [], quantity: 2 }];
  mockReplace.mockClear();
  mockClear.mockClear();
  mockFetchRestaurant.mockReset().mockResolvedValue(restaurant);
  mockFetchZones.mockReset().mockResolvedValue(zones);
  mockQuote.mockReset().mockResolvedValue({ deliverable: true, fee: '40.00', eta_minutes: 35 });
  mockPlace.mockReset().mockResolvedValue({ order_code: 'FD-123' });
  mockValidateCoupon.mockReset();
});

const fillContact = async () => {
  await changeTextFlushed(screen.getByLabelText('contactName'), 'Billal');
  await changeTextFlushed(screen.getByLabelText('phone'), '8801842168117');
  await changeTextFlushed(screen.getByLabelText('deliveryAddress'), 'Ujanchar bazar');
};

test('offers only the zones this restaurant actually serves', async () => {
  // Sourcing the dropdown from anything but served_zone_ids is the documented
  // cause of the old "Couldn't place order" 400 — the form offered an area the
  // order endpoint then rejected.
  await renderFlushed(<FoodCheckout />);
  await waitFor(() => expect(screen.getByLabelText('zone-1')).toBeTruthy());
  expect(screen.queryByLabelText('zone-2')).toBeNull();
});

test('served_zone_ids null means every zone, not none', async () => {
  mockFetchRestaurant.mockResolvedValue({ ...restaurant, served_zone_ids: null });
  await renderFlushed(<FoodCheckout />);
  await waitFor(() => expect(screen.getByLabelText('zone-1')).toBeTruthy());
  expect(screen.getByLabelText('zone-2')).toBeTruthy();
});

test('quotes the delivery fee from the server once an area is chosen', async () => {
  await renderFlushed(<FoodCheckout />);
  await waitFor(() => expect(screen.getByLabelText('zone-1')).toBeTruthy());
  await pressFlushed(screen.getByLabelText('zone-1'));

  await waitFor(() => expect(mockQuote).toHaveBeenCalled());
  expect(mockQuote.mock.calls[0][1]).toMatchObject({ restaurant: 'rahim', zone: 1 });
  await waitFor(() => expect(screen.getByText('৳40.00')).toBeTruthy());
});

test('refuses to place an order to an address the server will not deliver to', async () => {
  mockQuote.mockResolvedValue({ deliverable: false, reason: 'Too far to deliver.' });
  await renderFlushed(<FoodCheckout />);
  await waitFor(() => expect(screen.getByLabelText('zone-1')).toBeTruthy());
  await fillContact();
  await pressFlushed(screen.getByLabelText('zone-1'));

  await waitFor(() => expect(screen.getByText('Too far to deliver.')).toBeTruthy());
  await pressFlushed(screen.getByLabelText('placeOrder'));
  expect(mockPlace).not.toHaveBeenCalled();
});

test('blocks an order below the restaurant minimum', async () => {
  mockFetchRestaurant.mockResolvedValue({ ...restaurant, min_order_amount: '500.00' });
  await renderFlushed(<FoodCheckout />);
  await waitFor(() => expect(screen.getByText(/minimumNotMet/)).toBeTruthy());
  await fillContact();
  await pressFlushed(screen.getByLabelText('zone-1'));
  await waitFor(() => expect(mockQuote).toHaveBeenCalled());

  await pressFlushed(screen.getByLabelText('placeOrder'));
  expect(mockPlace).not.toHaveBeenCalled();
});

test('places the order, clears the cart and goes to tracking', async () => {
  await renderFlushed(<FoodCheckout />);
  await waitFor(() => expect(screen.getByLabelText('zone-1')).toBeTruthy());
  await fillContact();
  await pressFlushed(screen.getByLabelText('zone-1'));
  await waitFor(() => expect(screen.getByText('৳40.00')).toBeTruthy());

  await pressFlushed(screen.getByLabelText('placeOrder'));

  await waitFor(() => expect(mockPlace).toHaveBeenCalled());
  const body = mockPlace.mock.calls[0][1];
  expect(body).toMatchObject({
    restaurant_slug: 'rahim',
    contact_name: 'Billal',
    contact_phone: '8801842168117',
    zone_id: 1,
    payment_method: 'COD',
  });
  expect(body.items).toEqual([{ item_id: 11, quantity: 2, option_ids: [] }]);
  await waitFor(() => expect(mockClear).toHaveBeenCalled());
  // Guest tracking needs the phone: the track view 404s without a match.
  expect(mockReplace).toHaveBeenCalledWith(
    expect.stringContaining('/food/orders/FD-123?phone='),
  );
});

test('shows the server reason when the order is rejected', async () => {
  const err: any = new Error('Could not place order');
  err.errors = ['This restaurant is currently closed.'];
  err.fieldErrors = {};
  mockPlace.mockRejectedValue(err);

  await renderFlushed(<FoodCheckout />);
  await waitFor(() => expect(screen.getByLabelText('zone-1')).toBeTruthy());
  await fillContact();
  await pressFlushed(screen.getByLabelText('zone-1'));
  await waitFor(() => expect(screen.getByText('৳40.00')).toBeTruthy());

  await pressFlushed(screen.getByLabelText('placeOrder'));
  // The actionable text lives in `errors`; showing only `message` would tell
  // the customer nothing about what to fix.
  await waitFor(() => expect(screen.getByText('This restaurant is currently closed.')).toBeTruthy());
  expect(mockClear).not.toHaveBeenCalled();
});

test('applies a valid coupon to the total', async () => {
  mockValidateCoupon.mockResolvedValue({ valid: true, code: 'EID30', discount: '30.00' });
  await renderFlushed(<FoodCheckout />);
  await waitFor(() => expect(screen.getByLabelText('zone-1')).toBeTruthy());
  await pressFlushed(screen.getByLabelText('zone-1'));
  await waitFor(() => expect(screen.getByText('৳40.00')).toBeTruthy());

  await changeTextFlushed(screen.getByLabelText('couponCode'), 'EID30');
  await pressFlushed(screen.getByLabelText('apply'));

  await waitFor(() => expect(screen.getByText('couponApplied')).toBeTruthy());
  // 200 subtotal − 30 discount + 40 delivery
  await waitFor(() => expect(screen.getByText('৳210.00')).toBeTruthy());
});
