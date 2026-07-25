import MockAdapter from 'axios-mock-adapter';
import { createApiClient } from '../api/client';
import { registerForPush } from './register';

const store = () => ({ getAccess: async () => 'A', getRefresh: async () => 'R', setTokens: async () => {}, clear: async () => {} });

test('registers token when permission granted', async () => {
  const api = createApiClient(store());
  const mock = new MockAdapter(api);
  let posted: any = null;
  mock.onPost('/food/devices/register/').reply((cfg) => { posted = JSON.parse(cfg.data); return [200, { data: {} }]; });
  const deps = {
    getPermissions: async () => ({ granted: true }),
    requestPermissions: async () => ({ granted: true }),
    getExpoPushToken: async () => 'ExponentPushToken[zzz]',
    platform: 'android' as const,
  };
  const token = await registerForPush(api, 'rider', deps);
  expect(token).toBe('ExponentPushToken[zzz]');
  expect(posted).toEqual({ expo_token: 'ExponentPushToken[zzz]', app: 'rider', platform: 'android' });
});

test('returns null when permission denied', async () => {
  const api = createApiClient(store());
  new MockAdapter(api);
  const deps = { getPermissions: async () => ({ granted: false }), requestPermissions: async () => ({ granted: false }),
    getExpoPushToken: async () => 'x', platform: 'android' as const };
  expect(await registerForPush(api, 'customer', deps)).toBeNull();
});
