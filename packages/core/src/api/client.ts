import axios, { AxiosInstance, AxiosError } from 'axios';
import { getApiBaseUrl } from '../env';
import { TokenStore } from './tokenStore';

export function createApiClient(store: TokenStore): AxiosInstance {
  const api = axios.create({ baseURL: getApiBaseUrl(), timeout: 15000 });

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
      if (error.response?.status === 401 && original && !original._retried) {
        original._retried = true;
        if (!refreshing) {
          refreshing = (async () => {
            const refresh = await store.getRefresh();
            if (!refresh) return null;
            try {
              const res = await api.post('store/auth/refresh/', { refresh });
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
