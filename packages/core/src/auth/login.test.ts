import MockAdapter from 'axios-mock-adapter';
import { createApiClient } from '../api/client';
import { login } from './login';

const store = () => ({ getAccess: async () => null, getRefresh: async () => null,
  setTokens: async () => {}, clear: async () => {} });

function makeJwt(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

test('login decodes role and username from the JWT access claim', async () => {
  const api = createApiClient(store());
  const mock = new MockAdapter(api);
  const access = makeJwt({ role: 'Rider', username: 'r1' });
  mock.onPost('/store/auth/login/').reply(200, { access, refresh: 'R', message: 'Login successful' });
  const res = await login(api, '01700000000', 'pw');
  expect(res.access).toBe(access);
  expect(res.role).toBe('Rider');
  expect(res.username).toBe('r1');
});
