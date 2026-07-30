import { AxiosInstance } from 'axios';
import { endpoints } from '../../api/endpoints';
import { toStoreApiError } from '../errors';
import { StoreCategory } from '../types';

// `store/categories/` is NOT a `storefront` list endpoint (no pagination —
// `pagination_class = None` on the Django view) — it returns the FLAT
// `{data: [...], message}` envelope, unlike `store/products/`.
export async function fetchCategories(api: AxiosInstance): Promise<StoreCategory[]> {
  try {
    const res = await api.get(endpoints.storeCategories);
    return res.data.data;
  } catch (e) {
    throw toStoreApiError(e);
  }
}
