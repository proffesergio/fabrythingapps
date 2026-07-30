// Shapes for placing a COD order via `store/orders/` -- see
// `PlaceOrderSerializer` in
// `../../fabrythingweb/backend/EcommerceInventory/storefront/serializers.py`.

export interface PlaceOrderItemInput {
  variant_id: number;
  quantity: number;
}

// A one-off delivery address typed in at checkout. Both guest and signed-in
// customers may use this; a signed-in customer could alternatively pass
// `shipping_address_id` for a saved address, but this app only offers inline
// entry for now.
export interface InlineShippingAddress {
  address_type?: string;
  address: string;
  city: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface PlaceOrderInput {
  items: PlaceOrderItemInput[];
  shipping_address_id?: number;
  shipping_address?: InlineShippingAddress;
  contact_name: string;
  contact_phone: string;
  notes?: string;
}

// The authoritative post-checkout breakdown -- `shipping_amount` and
// `total_amount` are resolved server-side (`StoreConfiguration.shipping_for`)
// and must be displayed exactly as returned, never recomputed.
export interface PlaceOrderResult {
  order_id: number;
  order_number: string;
  subtotal: number;
  shipping_amount: number;
  total_amount: number;
  currency: string;
  status: string;
}
