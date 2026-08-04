import {
  fetchRiderEarnings,
  fetchRiderOffer,
  fetchRiderOrders,
  fetchRiderProfile,
  respondToOffer,
  sendRiderHeartbeat,
  setRiderAvailability,
  setRiderOrderStatus,
} from './index';
import { StoreApiError } from '../store/errors';

function apiWith(handlers: Record<string, any>) {
  const calls: Array<{ method: string; url: string; body?: any }> = [];
  const respond = (method: string) => (url: string, body?: any) => {
    calls.push({ method, url, body });
    const h = handlers[`${method} ${url}`];
    if (!h) return Promise.reject(new Error(`unstubbed ${method} ${url}`));
    return typeof h === 'function' ? h() : Promise.resolve(h);
  };
  return {
    api: { get: respond('get'), post: respond('post'), patch: respond('patch') } as any,
    calls,
  };
}

describe('rider client', () => {
  it('unwraps the flat {data} envelope for the profile', async () => {
    const { api } = apiWith({
      'get food/rider/me/': { data: { data: { id: 3, is_available: true, cash_in_hand: '250.00' } } },
    });
    const rider = await fetchRiderProfile(api);
    expect(rider.id).toBe(3);
    expect(rider.cash_in_hand).toBe('250.00');
  });

  it('falls back to res.data when a food view returns the payload directly', async () => {
    const { api } = apiWith({ 'get food/rider/me/': { data: { id: 9, is_available: false } } });
    expect((await fetchRiderProfile(api)).id).toBe(9);
  });

  it('returns null when there is no pending offer', async () => {
    const { api } = apiWith({ 'get food/rider/offer/': { data: { data: { offer: null } } } });
    expect(await fetchRiderOffer(api)).toBeNull();
  });

  it('returns the offer with the server-authoritative countdown', async () => {
    const offer = {
      offer_id: 1,
      seconds_left: 42,
      order_code: 'FT12',
      restaurant_name: 'Kacchi Bhai',
      restaurant_lat: null,
      restaurant_lng: null,
      delivery_address: 'Bancharampur',
      delivery_lat: null,
      delivery_lng: null,
      distance_km: '3.2',
      payment_method: 'COD',
      total: '540.00',
      rider_pay: '60.00',
    };
    const { api } = apiWith({ 'get food/rider/offer/': { data: { data: { offer } } } });
    const got = await fetchRiderOffer(api);
    expect(got?.seconds_left).toBe(42);
    expect(got?.rider_pay).toBe('60.00');
  });

  it('posts the accept action and reports the assigned order', async () => {
    const { api, calls } = apiWith({
      'post food/rider/offer/': { data: { data: { accepted: true, order_id: 77 } } },
    });
    const res = await respondToOffer(api, 'accept');
    expect(res.accepted).toBe(true);
    expect(res.order_id).toBe(77);
    expect(calls[0].body).toEqual({ action: 'accept' });
  });

  it('surfaces a 409 (offer taken between poll and tap) as a StoreApiError', async () => {
    const err: any = new Error('gone');
    err.isAxiosError = true;
    err.response = { status: 409, data: { message: 'That offer is no longer available' } };
    const { api } = apiWith({ 'post food/rider/offer/': () => Promise.reject(err) });
    await expect(respondToOffer(api, 'accept')).rejects.toBeInstanceOf(StoreApiError);
    await expect(respondToOffer(api, 'accept')).rejects.toMatchObject({ status: 409 });
  });

  it('always returns an array of assigned orders', async () => {
    const { api } = apiWith({ 'get food/rider/orders/': { data: { data: null } } });
    expect(await fetchRiderOrders(api)).toEqual([]);
  });

  it('sends heartbeat coords when given, empty body otherwise', async () => {
    const { api, calls } = apiWith({ 'post food/rider/heartbeat/': { data: {} } });
    await sendRiderHeartbeat(api, { lat: 23.8, lng: 90.4 });
    await sendRiderHeartbeat(api);
    expect(calls[0].body).toEqual({ lat: 23.8, lng: 90.4 });
    expect(calls[1].body).toEqual({});
  });

  it('toggles availability and patches order status', async () => {
    const { api, calls } = apiWith({
      'post food/rider/availability/': { data: { data: { id: 1, is_available: false } } },
      'patch food/rider/orders/5/status/': { data: { data: { id: 5, order_code: 'X', status: 'DELIVERED' } } },
    });
    expect((await setRiderAvailability(api, false)).is_available).toBe(false);
    expect(calls[0].body).toEqual({ is_available: false });
    expect((await setRiderOrderStatus(api, 5, 'DELIVERED')).status).toBe('DELIVERED');
    expect(calls[1].body).toEqual({ status: 'DELIVERED' });
  });

  it('reads earnings including cash still in hand', async () => {
    const { api } = apiWith({
      'get food/rider/earnings/': { data: { data: { today_payout: '300.00', cash_in_hand: '120.00' } } },
    });
    const e = await fetchRiderEarnings(api);
    expect(e.today_payout).toBe('300.00');
    expect(e.cash_in_hand).toBe('120.00');
  });
});
