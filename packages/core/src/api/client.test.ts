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

test('single-flight refresh: concurrent 401s share one refresh call, and refreshing resets after', async () => {
  const store = memStore();
  const api = createApiClient(store);
  const mock = new MockAdapter(api);

  let refreshCalls = 0;
  mock.onPost('/store/auth/refresh/').reply(() => {
    refreshCalls++;
    return [200, { access: `A${refreshCalls}`, refresh: `R${refreshCalls}` }];
  });

  let aCalls = 0;
  mock.onGet('/a/').reply(() => (++aCalls === 1 ? [401, {}] : [200, { who: 'a' }]));
  let bCalls = 0;
  mock.onGet('/b/').reply(() => (++bCalls === 1 ? [401, {}] : [200, { who: 'b' }]));

  // Two concurrent requests both hit a 401 at roughly the same time; only one
  // refresh call should be made and both requests should succeed on retry.
  const [resA, resB] = await Promise.all([api.get('/a/'), api.get('/b/')]);
  expect(resA.data).toEqual({ who: 'a' });
  expect(resB.data).toEqual({ who: 'b' });
  expect(refreshCalls).toBe(1);

  // A later, separate 401 (after the in-flight refresh resolved) must trigger
  // its own refresh call - i.e. `refreshing` was reset to null.
  let cCalls = 0;
  mock.onGet('/c/').reply(() => (++cCalls === 1 ? [401, {}] : [200, { who: 'c' }]));
  const resC = await api.get('/c/');
  expect(resC.data).toEqual({ who: 'c' });
  expect(refreshCalls).toBe(2);
});

test('refresh endpoint itself 401s: request rejects without hanging and token store is cleared', async () => {
  const store = memStore();
  const api = createApiClient(store);
  const mock = new MockAdapter(api);

  mock.onPost('/store/auth/refresh/').reply(401, {});
  mock.onGet('/protected/').reply(401, {});

  await expect(api.get('/protected/')).rejects.toBeTruthy();
  expect(await store.getAccess()).toBe('');
  expect(await store.getRefresh()).toBe('');
});
