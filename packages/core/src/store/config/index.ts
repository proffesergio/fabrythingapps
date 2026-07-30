import { AxiosInstance } from 'axios';
import { endpoints } from '../../api/endpoints';
import { toStoreApiError } from '../errors';
import { StoreConfig } from '../types';

// `store/config/` is a flat `{data, message}` endpoint — the authoritative
// shipping rate/currency/COD flag a screen displays but never recomputes.
export async function fetchStoreConfig(api: AxiosInstance): Promise<StoreConfig> {
  try {
    const res = await api.get(endpoints.storeConfig);
    return res.data.data;
  } catch (e) {
    throw toStoreApiError(e);
  }
}
