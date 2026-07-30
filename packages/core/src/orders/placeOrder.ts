import { AxiosInstance } from 'axios';
import { endpoints } from '../api/endpoints';
import { toStoreApiError } from '../store/errors';
import { PlaceOrderInput, PlaceOrderResult } from './types';

// `store/orders/` returns a flat `{data, message}` envelope on success (201).
// On failure the envelope is `{errors, field_errors, message}` -- a field
// validation failure (e.g. a missing contact_phone) lands in `field_errors`
// keyed by input name; a policy rejection with no associated field (Rx sales
// disabled, out-of-stock, COD disabled) lands as a plain message in `errors`
// with an empty `field_errors`. `toStoreApiError` normalizes both into one
// shape -- see `../store/errors.ts`.
export async function placeOrder(api: AxiosInstance, input: PlaceOrderInput): Promise<PlaceOrderResult> {
  try {
    const res = await api.post(endpoints.storeOrders, input);
    return res.data.data;
  } catch (e) {
    throw toStoreApiError(e);
  }
}
