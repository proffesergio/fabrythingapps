import { AxiosInstance } from 'axios';
import { endpoints } from '../api/endpoints';
import { toStoreApiError } from '../store/errors';
import { CartLine, ServerCartLine } from './types';

// `store/cart/` is a flat `{data, message}` endpoint (auth required) --
// the signed-in customer's server-persisted cart.
export async function fetchServerCart(api: AxiosInstance): Promise<ServerCartLine[]> {
  try {
    const res = await api.get(endpoints.storeCart);
    return res.data.data;
  } catch (e) {
    throw toStoreApiError(e);
  }
}

// Union a guest's local cart into the just-signed-in user's server cart --
// call this once, immediately after sign-in, then clear the local cart on
// success (the server is the source of truth for a signed-in customer from
// then on). The server itself ignores an unknown/inactive variant_id rather
// than failing the whole merge, and sums quantity for a variant already on
// the server cart -- see `CartMergeView` in
// `../../fabrythingweb/backend/EcommerceInventory/storefront/views.py`.
export async function mergeCartOnLogin(api: AxiosInstance, lines: CartLine[]): Promise<ServerCartLine[]> {
  const items = lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({ variant_id: l.variantId, quantity: l.quantity }));
  try {
    const res = await api.post(endpoints.storeCartMerge, { items });
    return res.data.data;
  } catch (e) {
    throw toStoreApiError(e);
  }
}
