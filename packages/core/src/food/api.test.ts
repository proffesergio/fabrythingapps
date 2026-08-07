import {
  fetchDeliveryQuote,
  fetchFoodOrders,
  fetchRestaurant,
  fetchRestaurants,
  fetchZones,
  placeFoodOrder,
  trackFoodOrder,
  validateCoupon,
} from './api';
import { StoreApiError } from '../store/errors';

function apiWith(handlers: Record<string, any>) {
  const calls: Array<{ method: string; url: string; body?: any; params?: any }> = [];
  const respond = (method: string) => (url: string, a?: any, b?: any) => {
    const body = method === 'get' ? undefined : a;
    const params = method === 'get' ? a?.params : b?.params;
    calls.push({ method, url, body, params });
    const h = handlers[`${method} ${url}`];
    if (!h) return Promise.reject(new Error(`unstubbed ${method} ${url}`));
    return typeof h === 'function' ? h() : Promise.resolve(h);
  };
  return { api: { get: respond('get'), post: respond('post') } as any, calls };
}

describe('restaurants', () => {
  it('unwraps the nested list envelope', async () => {
    // PublicRestaurantListView uses CommonListAPIMixin, whose envelope is
    // {data: {data: [...]}} — not the flat {data: [...]} the rider views use.
    const { api } = apiWith({
      'get food/restaurants/': { data: { data: { data: [{ id: 1, slug: 'kabab-ghar' }] } } },
    });
    const rows = await fetchRestaurants(api);
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe('kabab-ghar');
  });

  it('tolerates a flat list envelope too', async () => {
    const { api } = apiWith({ 'get food/restaurants/': { data: { data: [{ id: 2, slug: 'x' }] } } });
    expect(await fetchRestaurants(api)).toHaveLength(1);
  });

  it('returns [] rather than throwing when the payload is not a list', async () => {
    const { api } = apiWith({ 'get food/restaurants/': { data: { data: null } } });
    expect(await fetchRestaurants(api)).toEqual([]);
  });

  it('passes zone and pin through as query params', async () => {
    const { api, calls } = apiWith({ 'get food/restaurants/': { data: { data: { data: [] } } } });
    await fetchRestaurants(api, { zone: 4, lat: 23.9, lng: 90.9, sort: 'distance' });
    expect(calls[0].params).toEqual({ zone: 4, lat: 23.9, lng: 90.9, sort: 'distance' });
  });

  it('omits undefined filters instead of sending them as empty', async () => {
    const { api, calls } = apiWith({ 'get food/restaurants/': { data: { data: { data: [] } } } });
    await fetchRestaurants(api, { zone: 4 });
    expect(calls[0].params).toEqual({ zone: 4 });
  });

  it('fetches one restaurant with its menu', async () => {
    const { api, calls } = apiWith({
      'get food/restaurants/kabab-ghar/': {
        data: { data: { id: 1, slug: 'kabab-ghar', categories: [{ id: 5, items: [] }] } },
      },
    });
    const r = await fetchRestaurant(api, 'kabab-ghar');
    expect(r.categories).toHaveLength(1);
    expect(calls[0].url).toBe('food/restaurants/kabab-ghar/');
  });
});

describe('zones', () => {
  it('returns zones with their villages', async () => {
    const { api } = apiWith({
      'get food/zones/': { data: { data: [{ id: 1, name: 'Z', villages: [{ id: 9, name: 'V' }] }] } },
    });
    const zones = await fetchZones(api);
    expect(zones[0].villages[0].id).toBe(9);
  });
});

describe('delivery quote', () => {
  it('returns the fee for a deliverable address', async () => {
    const { api, calls } = apiWith({
      'get food/delivery-quote/': {
        data: { data: { deliverable: true, fee: '40.00', distance_km: '2.5', eta_minutes: 35 } },
      },
    });
    const q = await fetchDeliveryQuote(api, { restaurant: 'kabab-ghar', village: 9 });
    expect(q.deliverable).toBe(true);
    expect(q.fee).toBe('40.00');
    expect(calls[0].params).toEqual({ restaurant: 'kabab-ghar', village: 9 });
  });

  it('surfaces an out-of-range refusal as data, not an error', async () => {
    // The server answers 200 with deliverable:false so the UI can explain the
    // refusal. Throwing here would turn an explanation into a crash.
    const { api } = apiWith({
      'get food/delivery-quote/': {
        data: { data: { deliverable: false, reason: 'Too far to deliver.' } },
      },
    });
    const q = await fetchDeliveryQuote(api, { restaurant: 'x' });
    expect(q.deliverable).toBe(false);
    expect(q.reason).toBe('Too far to deliver.');
  });
});

describe('placing an order', () => {
  it('posts the cart and returns the created order', async () => {
    const { api, calls } = apiWith({
      'post food/orders/': { data: { data: { id: 1, order_code: 'FD-123', status: 'PLACED' } } },
    });
    const order = await placeFoodOrder(api, {
      restaurant_slug: 'kabab-ghar',
      items: [{ item_id: 3, quantity: 2, option_ids: [7] }],
      contact_name: 'Billal',
      contact_phone: '8801842168117',
      delivery_address: 'Bancharampur',
      village_id: 9,
    });
    expect(order.order_code).toBe('FD-123');
    expect(calls[0].body.items[0].option_ids).toEqual([7]);
  });

  it('normalises a rejection into a StoreApiError carrying the reason', async () => {
    // FoodOrderView returns {errors: [...], message: "Could not place order"}
    // on a 400 — a closed restaurant, an under-minimum basket, a bad coupon.
    const err: any = new Error('Could not place order');
    err.isAxiosError = true;
    err.response = {
      status: 400,
      data: {
        message: 'Could not place order',
        errors: ['This restaurant is currently closed.'],
        field_errors: {},
      },
    };
    const { api } = apiWith({ 'post food/orders/': () => Promise.reject(err) });
    await expect(
      placeFoodOrder(api, {
        restaurant_slug: 'x', items: [], contact_name: '', contact_phone: '', delivery_address: '',
      }),
    ).rejects.toMatchObject({ status: 400 });

    try {
      await placeFoodOrder(api, {
        restaurant_slug: 'x', items: [], contact_name: '', contact_phone: '', delivery_address: '',
      });
      throw new Error('should have rejected');
    } catch (e) {
      // The actionable reason is in `errors`; `message` is only the generic
      // "Could not place order" envelope text, so a screen showing `message`
      // alone would tell the customer nothing.
      expect((e as StoreApiError).errors).toEqual(['This restaurant is currently closed.']);
      expect((e as StoreApiError).message).toBe('Could not place order');
    }
  });
});

describe('tracking', () => {
  it('sends the guest phone so an unauthenticated customer can track', async () => {
    // FoodOrderTrackView 404s a guest without ?phone= matching guest_phone.
    const { api, calls } = apiWith({
      'get food/orders/FD-123/': { data: { data: { order_code: 'FD-123', status: 'PREPARING' } } },
    });
    const order = await trackFoodOrder(api, 'FD-123', '8801842168117');
    expect(order.status).toBe('PREPARING');
    expect(calls[0].params).toEqual({ phone: '8801842168117' });
  });

  it('omits the phone param when signed in', async () => {
    const { api, calls } = apiWith({
      'get food/orders/FD-9/': { data: { data: { order_code: 'FD-9' } } },
    });
    await trackFoodOrder(api, 'FD-9');
    expect(calls[0].params).toBeUndefined();
  });

  it('lists the signed-in customer history', async () => {
    const { api } = apiWith({ 'get food/orders/': { data: { data: [{ order_code: 'FD-1' }] } } });
    expect(await fetchFoodOrders(api)).toHaveLength(1);
  });
});

describe('coupons', () => {
  it('posts the code with the restaurant and subtotal', async () => {
    const { api, calls } = apiWith({
      'post food/coupons/validate/': { data: { data: { valid: true, discount: '30.00' } } },
    });
    const res = await validateCoupon(api, { code: 'EID30', restaurant_slug: 'kabab-ghar', subtotal: '300.00' });
    expect(res.discount).toBe('30.00');
    expect(calls[0].body.code).toBe('EID30');
  });
});
