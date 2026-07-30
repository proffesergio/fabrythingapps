import { AxiosInstance } from 'axios';
import { endpoints } from '../../api/endpoints';
import { toStoreApiError } from '../errors';
import { PaginatedResult, ProductListParams, StoreProduct, StoreProductDetail } from '../types';
import { buildProductQuery } from './query';

export { buildProductQuery } from './query';

// `store/products/` is a `storefront` list endpoint — it returns the NESTED
// envelope `{data: {data: [...], totalPages, totalItems, currentPage,
// pageSize}}`. Unwrapped here so no screen ever has to know that.
export async function fetchProducts(
  api: AxiosInstance,
  params: ProductListParams = {},
): Promise<PaginatedResult<StoreProduct>> {
  try {
    const res = await api.get(`${endpoints.storeProducts}${buildProductQuery(params)}`);
    const envelope = res.data.data;
    return {
      items: envelope.data,
      totalPages: envelope.totalPages,
      totalItems: envelope.totalItems,
      currentPage: envelope.currentPage,
      pageSize: envelope.pageSize,
    };
  } catch (e) {
    throw toStoreApiError(e);
  }
}

// `store/products/<slug>/` is a flat `{data, message}` endpoint (not a
// `storefront` list endpoint), so no envelope unwrapping needed beyond `.data`.
export async function fetchProductDetail(api: AxiosInstance, slug: string): Promise<StoreProductDetail> {
  try {
    const res = await api.get(endpoints.storeProductDetail(slug));
    return res.data.data;
  } catch (e) {
    throw toStoreApiError(e);
  }
}
