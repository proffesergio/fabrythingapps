import { screen, waitFor } from '@testing-library/react-native';
import { renderFlushed, pressFlushed } from '../src/test-utils';
import OfferScreen from './offer';

jest.mock('../src/providers', () => ({ api: {} }));

const mockFetchOffer = jest.fn();
const mockRespond = jest.fn();

jest.mock('@fabrything/core', () => {
  const actual = jest.requireActual('@fabrything/core');
  return {
    ...actual,
    fetchRiderOffer: (...a: any[]) => mockFetchOffer(...a),
    respondToOffer: (...a: any[]) => mockRespond(...a),
  };
});

const OFFER = {
  offer_id: 1,
  seconds_left: 45,
  order_code: 'FT991',
  restaurant_name: 'Kacchi Bhai',
  restaurant_lat: null,
  restaurant_lng: null,
  delivery_address: 'Bancharampur Bazar',
  delivery_lat: null,
  delivery_lng: null,
  distance_km: '3.4',
  payment_method: 'COD',
  total: '540.00',
  rider_pay: '65.00',
};

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

test('shows the empty state when there is no pending offer', async () => {
  mockFetchOffer.mockResolvedValue(null);
  await renderFlushed(<OfferScreen />);
  expect(await screen.findByText(/No delivery offers right now/i)).toBeTruthy();
});

test('renders the offer with the pay the rider actually earns', async () => {
  mockFetchOffer.mockResolvedValue(OFFER);
  await renderFlushed(<OfferScreen />);
  expect(await screen.findByText('Kacchi Bhai')).toBeTruthy();
  expect(screen.getByText('৳65.00')).toBeTruthy();
  expect(screen.getByText('3.4 km')).toBeTruthy();
});

test('accepting posts the accept action', async () => {
  mockFetchOffer.mockResolvedValue(OFFER);
  mockRespond.mockResolvedValue({ accepted: true, order_id: 7 });
  await renderFlushed(<OfferScreen />);
  const btn = await screen.findByLabelText('Accept');
  await pressFlushed(btn);
  await waitFor(() => expect(mockRespond).toHaveBeenCalledWith({}, 'accept'));
});

// The offer being snatched between poll and tap is a normal race in the
// dispatch cascade, not a crash — the rider must be told plainly.
test('a 409 shows "no longer available" instead of a generic error', async () => {
  mockFetchOffer.mockResolvedValue(OFFER);
  const err: any = new Error('gone');
  err.status = 409;
  mockRespond.mockRejectedValue(err);
  await renderFlushed(<OfferScreen />);
  const btn = await screen.findByLabelText('Accept');
  await pressFlushed(btn);
  expect(await screen.findByText(/no longer available/i)).toBeTruthy();
});

test('declining posts the decline action', async () => {
  mockFetchOffer.mockResolvedValue(OFFER);
  mockRespond.mockResolvedValue({ declined: true });
  await renderFlushed(<OfferScreen />);
  const btn = await screen.findByLabelText('Decline');
  await pressFlushed(btn);
  await waitFor(() => expect(mockRespond).toHaveBeenCalledWith({}, 'decline'));
});
