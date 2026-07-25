import { act, create } from 'react-test-renderer';
import { AxiosInstance } from 'axios';
import { AuthProvider, useAuth } from './useAuth';
import { TokenStore } from '../api/tokenStore';

function makeJwt(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

function Probe({ onState }: { onState: (s: ReturnType<typeof useAuth>) => void }) {
  const state = useAuth();
  onState(state);
  return null;
}

test('AuthProvider restores role/username from a stored access token on mount', async () => {
  const access = makeJwt({ role: 'Customer', username: 'cust1' });
  const store: TokenStore = {
    getAccess: async () => access,
    getRefresh: async () => null,
    setTokens: async () => {},
    clear: async () => {},
  };
  const api = {} as AxiosInstance;

  let latest: ReturnType<typeof useAuth> | undefined;
  await act(async () => {
    create(
      <AuthProvider api={api} store={store}>
        <Probe onState={(s) => { latest = s; }} />
      </AuthProvider>,
    );
  });

  expect(latest?.loading).toBe(false);
  expect(latest?.role).toBe('Customer');
  expect(latest?.username).toBe('cust1');
});

test('AuthProvider stays signed-out when no token is stored', async () => {
  const store: TokenStore = {
    getAccess: async () => null,
    getRefresh: async () => null,
    setTokens: async () => {},
    clear: async () => {},
  };
  const api = {} as AxiosInstance;

  let latest: ReturnType<typeof useAuth> | undefined;
  await act(async () => {
    create(
      <AuthProvider api={api} store={store}>
        <Probe onState={(s) => { latest = s; }} />
      </AuthProvider>,
    );
  });

  expect(latest?.loading).toBe(false);
  expect(latest?.role).toBeNull();
  expect(latest?.username).toBeNull();
});
