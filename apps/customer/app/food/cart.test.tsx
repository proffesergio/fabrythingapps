import { cleanup, screen } from '@testing-library/react-native';
import { renderFlushed, pressFlushed } from '../../src/test-utils';

const mockUpdateQuantity = jest.fn();
const mockRemoveItem = jest.fn();
const mockPush = jest.fn();
let mockLines: any[] = [];

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@fabrything/core', () => ({
  t: (k: string) => k,
  theme: { light: { text: '#000', muted: '#888', line: '#eee', surface: '#fff', primary: '#E8452B', primaryDeep: '#B3261E' } },
  lineKey: (l: any) => `${l.itemId}:${[...l.optionIds].sort().join(',')}`,
  useFoodCart: () => ({
    lines: mockLines,
    loading: false,
    totals: {
      itemCount: mockLines.reduce((n, l) => n + l.quantity, 0),
      subtotal: mockLines.reduce(
        (n, l) => n + (Number(l.unitPrice) + l.optionLabels.reduce((s: number, o: any) => s + Number(o.price_delta), 0)) * l.quantity,
        0,
      ),
    },
    updateQuantity: mockUpdateQuantity,
    removeItem: mockRemoveItem,
  }),
  useSlowRequestHint: () => false,
}));

import FoodCartScreen from './cart';

const line = {
  itemId: 11, restaurantSlug: 'rahim', name: 'Biryani', image: null,
  unitPrice: '180.00', optionIds: [102],
  optionLabels: [{ name: 'Large', price_delta: '50.00' }], quantity: 2,
};

afterEach(cleanup);

beforeEach(() => {
  mockLines = [line];
  mockUpdateQuantity.mockClear();
  mockRemoveItem.mockClear();
  mockPush.mockClear();
});

test('shows the line total including option deltas', async () => {
  await renderFlushed(<FoodCartScreen />);
  expect(screen.getByText('Biryani')).toBeTruthy();
  expect(screen.getByText('Large')).toBeTruthy();
  // (180 + 50) * 2 — the option delta is part of what the server charges.
  // Appears twice: once as the line total, once as the cart subtotal.
  expect(screen.getAllByText('৳460.00')).toHaveLength(2);
});

test('steppers change the quantity by line key, not by item id', async () => {
  // Two option sets of the same item are two lines; keying on item id alone
  // would move the wrong one.
  await renderFlushed(<FoodCartScreen />);
  await pressFlushed(screen.getByLabelText('increase-11:102'));
  expect(mockUpdateQuantity).toHaveBeenCalledWith('11:102', 3);

  await pressFlushed(screen.getByLabelText('decrease-11:102'));
  expect(mockUpdateQuantity).toHaveBeenCalledWith('11:102', 1);
});

test('removes a line', async () => {
  await renderFlushed(<FoodCartScreen />);
  await pressFlushed(screen.getByLabelText('remove-11:102'));
  expect(mockRemoveItem).toHaveBeenCalledWith('11:102');
});

test('an empty cart offers a way back to the restaurants', async () => {
  mockLines = [];
  await renderFlushed(<FoodCartScreen />);
  expect(screen.getByText('emptyFoodCart')).toBeTruthy();
  await pressFlushed(screen.getByText('browseRestaurants'));
  expect(mockPush).toHaveBeenCalledWith('/food');
});

test('goes to checkout', async () => {
  await renderFlushed(<FoodCartScreen />);
  await pressFlushed(screen.getByText('proceedToCheckout'));
  expect(mockPush).toHaveBeenCalledWith('/food/checkout');
});
