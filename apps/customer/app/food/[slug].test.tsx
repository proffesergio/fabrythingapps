import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockFetchRestaurant = jest.fn();
const mockAddItem = jest.fn();
const mockWouldReplace = jest.fn(() => false);
const mockPush = jest.fn();

jest.mock('../../src/providers', () => ({ api: {} }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ slug: 'rahim' }),
}));
jest.mock('@fabrything/core', () => ({
  t: (k: string) => k,
  theme: { light: { text: '#000', muted: '#888', line: '#eee', surface: '#fff', primary: '#E8452B', primaryDeep: '#B3261E' } },
  fetchRestaurant: (...a: unknown[]) => mockFetchRestaurant(...a),
  useFoodCart: () => ({
    addItem: mockAddItem,
    wouldReplaceCart: mockWouldReplace,
    totals: { itemCount: 0, subtotal: 0 },
  }),
  useSlowRequestHint: () => false,
}));

import RestaurantMenu from './[slug]';

const plainItem = {
  id: 11, name: 'Naan', display_name: 'Naan', description: '', image: null,
  effective_price: '20.00', available_now: true, is_available: true, option_groups: [],
};

const optionItem = {
  id: 12, name: 'Biryani', display_name: 'Biryani', description: '', image: null,
  effective_price: '180.00', available_now: true, is_available: true,
  option_groups: [
    {
      id: 1, name: 'Size', is_required: true, min_select: 1, max_select: 1,
      options: [
        { id: 101, name: 'Regular', price_delta: '0.00', is_default: true },
        { id: 102, name: 'Large', price_delta: '50.00', is_default: false },
      ],
    },
  ],
};

const restaurant = {
  id: 1, name: 'Rahim Hotel', display_name: 'Rahim Hotel', slug: 'rahim',
  cover_image: null, address: 'Bancharampur', min_order_amount: '150.00',
  avg_prep_minutes: 25, is_open_now: true, is_accepting_orders: true, next_open: null,
  categories: [{ id: 5, name: 'Mains', display_name: 'Mains', items: [plainItem, optionItem] }],
};

// This RNTL build does not auto-clean between tests; a leaked tree keeps its
// modal mounted and the next test queries the wrong root.
afterEach(cleanup);

beforeEach(() => {
  mockAddItem.mockClear();
  mockAlert.mockClear();
  mockWouldReplace.mockReset().mockReturnValue(false);
  mockFetchRestaurant.mockReset().mockResolvedValue(restaurant);
});

test('adds an option-free item straight to the cart', async () => {
  render(<RestaurantMenu />);
  await waitFor(() => expect(screen.getByText('Naan')).toBeTruthy());

  fireEvent.press(screen.getByLabelText('addToFoodCart Naan'));
  expect(mockAddItem).toHaveBeenCalledWith(
    expect.objectContaining({ itemId: 11, restaurantSlug: 'rahim', unitPrice: '20.00', optionIds: [] }),
  );
});

test('an item with option groups opens the picker instead of adding blind', async () => {
  render(<RestaurantMenu />);
  await waitFor(() => expect(screen.getByText('Biryani')).toBeTruthy());

  fireEvent.press(screen.getByLabelText('addToFoodCart Biryani'));
  expect(mockAddItem).not.toHaveBeenCalled();
  expect(await screen.findByLabelText('confirm-options')).toBeTruthy();
});

test('the picker sends the chosen option id and its label', async () => {
  render(<RestaurantMenu />);
  await waitFor(() => expect(screen.getByText('Biryani')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('addToFoodCart Biryani'));

  fireEvent.press(await screen.findByLabelText('Large'));
  // Wait for the selection to land before confirming. RNTL's press returns
  // before the resulting re-render settles here, so confirming immediately
  // reads the previous selection — this is a harness timing rule, not a UI one.
  await waitFor(() =>
    expect(screen.getByLabelText('Large').props.accessibilityState.checked).toBe(true));
  fireEvent.press(screen.getByLabelText('confirm-options'));

  expect(mockAddItem).toHaveBeenCalledWith(
    expect.objectContaining({
      itemId: 12,
      optionIds: [102],
      optionLabels: [{ name: 'Large', price_delta: '50.00' }],
    }),
  );
});

test('a single-select group behaves as a radio, not an unresponsive checkbox', async () => {
  render(<RestaurantMenu />);
  await waitFor(() => expect(screen.getByText('Biryani')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('addToFoodCart Biryani'));

  // 'Regular' is the default; picking 'Large' must swap it, not be ignored
  // because max_select is already reached.
  fireEvent.press(await screen.findByLabelText('Large'));
  await waitFor(() =>
    expect(screen.getByLabelText('Large').props.accessibilityState.checked).toBe(true));
  // The previously-selected default must have been swapped out, not kept.
  expect(screen.getByLabelText('Regular').props.accessibilityState.checked).toBe(false);

  fireEvent.press(screen.getByLabelText('confirm-options'));
  expect(mockAddItem.mock.calls[0][0].optionIds).toEqual([102]);
});

test('warns before wiping a cart that belongs to another restaurant', async () => {
  // A food order posts one restaurant_slug, so this add is destructive. It
  // must be confirmed rather than silently discarding the previous cart.
  mockWouldReplace.mockReturnValue(true);
  render(<RestaurantMenu />);
  await waitFor(() => expect(screen.getByText('Naan')).toBeTruthy());

  fireEvent.press(screen.getByLabelText('addToFoodCart Naan'));
  expect(mockAddItem).not.toHaveBeenCalled();
  expect(mockAlert).toHaveBeenCalled();
});

test('a closed restaurant cannot be ordered from', async () => {
  mockFetchRestaurant.mockResolvedValue({ ...restaurant, is_open_now: false });
  render(<RestaurantMenu />);
  await waitFor(() => expect(screen.getByText(/restaurantClosedNow/)).toBeTruthy());

  fireEvent.press(screen.getByLabelText('addToFoodCart Naan'));
  expect(mockAddItem).not.toHaveBeenCalled();
});

test('an item outside its serving window is not orderable', async () => {
  // available_now honours the item's time-of-day window; is_available alone
  // would offer breakfast at midnight and the order would 400.
  mockFetchRestaurant.mockResolvedValue({
    ...restaurant,
    categories: [{ id: 5, name: 'Mains', display_name: 'Mains', items: [{ ...plainItem, available_now: false }] }],
  });
  render(<RestaurantMenu />);
  await waitFor(() => expect(screen.getByText('Naan')).toBeTruthy());

  expect(screen.getByText('unavailable')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('addToFoodCart Naan'));
  expect(mockAddItem).not.toHaveBeenCalled();
});
