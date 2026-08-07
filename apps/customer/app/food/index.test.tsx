import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockUseAuth = jest.fn<{ role: string | null; loading: boolean }, []>(() => ({
  role: 'Customer',
  loading: false,
}));
const mockPush = jest.fn();
const mockFetchRestaurants = jest.fn();

jest.mock('../../src/providers', () => ({ api: {} }));
jest.mock('../../src/push', () => ({ registerPush: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@fabrything/core', () => ({
  useAuth: () => mockUseAuth(),
  t: (k: string) => k,
  theme: { light: { text: '#000', muted: '#888', line: '#eee', surface: '#fff', primary: '#E8452B', primaryDeep: '#B3261E' } },
  fetchRestaurants: (...a: unknown[]) => mockFetchRestaurants(...a),
  fetchMobileConfig: jest.fn().mockResolvedValue({ min_supported_version: { customer: '0.0.1' } }),
  isVersionSupported: () => true,
  useSlowRequestHint: () => false,
}));

import FoodHome from './index';

const open = {
  id: 1, name: 'Rahim Hotel', display_name: 'Rahim Hotel', slug: 'rahim',
  cover_image: null, cuisine_type: 'Biryani', min_order_amount: '150.00',
  avg_prep_minutes: 25, is_open: true, is_open_now: true, is_accepting_orders: true,
  next_open: null, distance_km: 1.2,
};

beforeEach(() => {
  mockPush.mockClear();
  mockUseAuth.mockReturnValue({ role: 'Customer', loading: false });
  mockFetchRestaurants.mockReset().mockResolvedValue([open]);
});

test('renders a restaurant with the details a customer chooses on', async () => {
  render(<FoodHome />);
  await waitFor(() => expect(screen.getByText('Rahim Hotel')).toBeTruthy());
  expect(screen.getByText('Biryani')).toBeTruthy();
  expect(screen.getByText('1.2 km')).toBeTruthy();
  expect(screen.getByText('openNow')).toBeTruthy();
});

test('a guest can browse restaurants without logging in', async () => {
  // Deliberate change: food/restaurants/ is AllowAny, like the store. The old
  // behaviour bounced guests to login before they could see a single menu,
  // which is a worse funnel than the web has.
  mockUseAuth.mockReturnValue({ role: null, loading: false });
  render(<FoodHome />);
  await waitFor(() => expect(screen.getByText('Rahim Hotel')).toBeTruthy());
});

test('shows a closed restaurant as closed, using opening hours not the master switch', async () => {
  // is_open stays true around the clock; is_open_now is what the order
  // endpoint enforces, so it is what the card must show.
  mockFetchRestaurants.mockResolvedValue([
    { ...open, is_open_now: false, next_open: { weekday: 1, days_ahead: 0, open_time: '10:00' } },
  ]);
  render(<FoodHome />);
  await waitFor(() => expect(screen.getByText(/closedNow/)).toBeTruthy());
});

test('opens the menu for the tapped restaurant', async () => {
  render(<FoodHome />);
  await waitFor(() => expect(screen.getByText('Rahim Hotel')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Rahim Hotel'));
  expect(mockPush).toHaveBeenCalledWith('/food/rahim');
});

test('surfaces a load failure with a retry instead of an empty list', async () => {
  mockFetchRestaurants.mockRejectedValue(Object.assign(new Error('boom'), { message: 'boom' }));
  render(<FoodHome />);
  await waitFor(() => expect(screen.getByText('boom')).toBeTruthy());
});
