import { StoreApiError } from '../store/errors';

// The Rx-disabled rejection (see `place_cod_order` in
// `../../fabrythingweb/backend/EcommerceInventory/orders/services.py`) is a
// plain message in `errors` with no associated field -- e.g. "Cotton Panjabi
// requires a prescription and is not yet available for online purchase."
// There's no error code to key off, so detect it by the fixed phrase the
// backend always includes, and let the checkout screen swap in a clear,
// translated explanation instead of the raw backend sentence.
export function isRxBlockedError(error: StoreApiError): boolean {
  return error.errors.some((m) => /requires a prescription/i.test(m));
}
