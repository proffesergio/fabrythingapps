import { fetchVendorOrders, fetchVendorRestaurant, setVendorOrderStatus } from './index';
import { StoreApiError } from '../store/errors';

function apiWith(handlers: Record<string, any>) {
  const calls: Array<{ method: string; url: string; body?: any }> = [];
  const respond = (method: string) => (url: string, body?: any) => {
    calls.push({ method, url, body });
    const h = handlers[`${method} ${url}`];
    if (!h) return Promise.reject(new Error(`unstubbed ${method} ${url}`));
    return typeof h === 'function' ? h() : Promise.resolve(h);
  };
  return { api: { get: respond('get'), patch: respond('patch') } as any, calls };
}

describe('vendor client', () => {
  it('reads the restaurant profile', async () => {
    const { api } = apiWith({
      'get food/vendor/restaurant/': { data: { data: { id: 2, name: 'Kacchi Bhai', status: 'ACTIVE' } } },
    });
    expect((await fetchVendorRestaurant(api)).name).toBe('Kacchi Bhai');
  });

  it('handles the flat list envelope', async () => {
    const { api } = apiWith({
      'get food/vendor/orders/': { data: { data: [{ id: 1, order_code: 'A1', status: 'PLACED' }] } },
    });
    const orders = await fetchVendorOrders(api);
    expect(orders).toHaveLength(1);
    expect(orders[0].order_code).toBe('A1');
  });

  // The repo has two different list envelopes and reading the wrong one has
  // broken pages before — the client must survive the nested shape too.
  it('handles a nested list envelope without crashing', async () => {
    const { api } = apiWith({
      'get food/vendor/orders/': { data: { data: { data: [{ id: 4, order_code: 'B2', status: 'PLACED' }] } } },
    });
    expect((await fetchVendorOrders(api))[0].order_code).toBe('B2');
  });

  it('passes a status filter through', async () => {
    const { api, calls } = apiWith({
      'get food/vendor/orders/?status=PLACED': { data: { data: [] } },
    });
    await fetchVendorOrders(api, 'PLACED');
    expect(calls[0].url).toBe('food/vendor/orders/?status=PLACED');
  });

  it('returns [] rather than throwing when the payload is not a list', async () => {
    const { api } = apiWith({ 'get food/vendor/orders/': { data: { data: null } } });
    expect(await fetchVendorOrders(api)).toEqual([]);
  });

  it('patches a status transition', async () => {
    const { api, calls } = apiWith({
      'patch food/vendor/orders/7/status/': { data: { data: { id: 7, order_code: 'C3', status: 'PREPARING' } } },
    });
    expect((await setVendorOrderStatus(api, 7, 'PREPARING')).status).toBe('PREPARING');
    expect(calls[0].body).toEqual({ status: 'PREPARING' });
  });

  it('surfaces an illegal transition as a StoreApiError with the reason', async () => {
    const err: any = new Error('bad');
    err.isAxiosError = true;
    err.response = { status: 400, data: { message: 'Invalid transition', errors: ['PLACED -> DELIVERED'] } };
    const { api } = apiWith({ 'patch food/vendor/orders/7/status/': () => Promise.reject(err) });
    await expect(setVendorOrderStatus(api, 7, 'DELIVERED')).rejects.toMatchObject({
      status: 400,
      errors: ['PLACED -> DELIVERED'],
    });
  });
});
