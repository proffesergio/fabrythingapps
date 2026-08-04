import { StoreApiError } from '../store/errors';

// The Rx-disabled rejection (see `place_cod_order` in
// `../../fabrythingweb/backend/EcommerceInventory/orders/services.py`,
// re-read for Task 7 to check for a code: still just
// `raise ValidationError(f"{variant.product.name} requires a prescription
// and is not yet available for online purchase.")`) is a plain message in
// `errors` with no associated field and no error code -- ValidationError
// here carries only a string, and the storefront error envelope
// (`{errors, field_errors, message}`) has no code slot at all. So this
// stays a string match, kept to this ONE function so the coupling to the
// backend's exact wording lives in exactly one place: if the message
// changes, only this regex needs to change, and every caller (currently
// just checkout.tsx) goes through it rather than re-matching the phrase
// itself.
//
// TODO(backend): the cleanest real fix is for `place_cod_order` to raise
// something the client can key off structurally -- e.g. a distinct field
// key in `field_errors` (like `field_errors: {rx: [...]}`) or an
// `error_code` in the envelope -- instead of a message the client has to
// pattern-match. That's a `fabrythingweb` change, out of scope here.
export function isRxBlockedError(error: StoreApiError): boolean {
  return error.errors.some((m) => /requires a prescription/i.test(m));
}
