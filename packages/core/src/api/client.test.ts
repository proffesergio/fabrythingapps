import MockAdapter from 'axios-mock-adapter';
import { createApiClient } from './client';

const memStore = () => {
  let a = 'A', r = 'R';
  return { getAccess: async () => a, getRefresh: async () => r,
    setTokens: async (na: string, nr: string) => { a = na; r = nr; },
    clear: async () => { a = ''; r = ''; } };
};

test('attaches bearer token', async () => {
  const store = memStore();
  const api = createApiClient(store);
  const mock = new MockAdapter(api);
  mock.onGet('/food/restaurants/').reply((cfg) => {
    expect(cfg.headers?.Authorization).toBe('Bearer A');
    return [200, { data: [] }];
  });
  await api.get('/food/restaurants/');
});

test('refreshes once on 401 then retries', async () => {
  const store = memStore();
  const api = createApiClient(store);
  const mock = new MockAdapter(api);
  let calls = 0;
  mock.onGet('/food/rider/me/').reply(() => (++calls === 1 ? [401, {}] : [200, { ok: true }]));
  mock.onPost('/store/auth/refresh/').reply(200, { access: 'A2', refresh: 'R2' });
  const res = await api.get('/food/rider/me/');
  expect(res.data).toEqual({ ok: true });
  expect(await store.getAccess()).toBe('A2');
});
