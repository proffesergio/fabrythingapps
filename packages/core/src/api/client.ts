import axios, { AxiosInstance, AxiosError } from 'axios';
import { getApiBaseUrl } from '../env';
import { TokenStore } from './tokenStore';

// The API host (Render free tier) sleeps when idle -- the first request
// after a nap can take ~30s while the dyno wakes up. A 15s timeout used to
// cut that request off before the server had a chance to answer, turning a
// perfectly good cold-start request into a client-side timeout error. 45s
// gives the wake-up window room; screens pair this with
// `useSlowRequestHint` so a slow-but-succeeding request still gets an
// explanation instead of just spinning.
export const API_TIMEOUT_MS = 45000;

export function createApiClient(store: TokenStore): AxiosInstance {
  const api = axios.create({ baseURL: getApiBaseUrl(), timeout: API_TIMEOUT_MS });

  api.interceptors.request.use(async (config) => {
    const access = await store.getAccess();
    if (access) config.headers.Authorization = `Bearer ${access}`;
    return config;
  });

  let refreshing: Promise<string | null> | null = null;
  api.interceptors.response.use(
    (r) => r,
    async (error: AxiosError) => {
      const original: any = error.config;
      if (error.response?.status === 401 && original && !original._retried && !original._isRefreshCall) {
        original._retried = true;
        if (!refreshing) {
          refreshing = (async () => {
            const refresh = await store.getRefresh();
            if (!refresh) return null;
            try {
              const res = await api.post(
                'store/auth/refresh/',
                { refresh },
                { _isRefreshCall: true } as any,
              );
              await store.setTokens(res.data.access, res.data.refresh ?? refresh);
              return res.data.access as string;
            } catch {
              await store.clear();
              return null;
            }
          })();
        }
        const newAccess = await refreshing;
        refreshing = null;
        if (newAccess) {
          original.headers.Authorization = `Bearer ${newAccess}`;
          return api(original);
        }
      }
      return Promise.reject(error);
    },
  );
  return api;
}
