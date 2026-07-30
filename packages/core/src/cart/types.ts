// Local, persisted cart. A line is keyed by ProductVariant identity, not
// product id -- checkout charges `ProductVariant.effective_price`, so two
// different sizes/colors of the same product are two separate lines. Mirrors
// `CartItemSerializer` in
// `../../fabrythingweb/backend/EcommerceInventory/storefront/serializers.py`.
export interface CartLine {
  variantId: number;
  productId: number;
  productSlug: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  // Kept as a string, mirroring the server's DecimalField serialization of
  // `effective_price` -- never a JS float, so a display value can't quietly
  // drift from what the server would charge.
  unitPrice: string;
  quantity: number;
  stockQuantity: number;
  requiresPrescription: boolean;
  image: string | null;
}

export interface CartTotals {
  itemCount: number;
  // Sum of unitPrice * quantity. This is plain arithmetic on server-provided
  // per-line prices, NOT a recomputation of any server-side business rule --
  // shipping is the part that must never be estimated client-side (see
  // `cart/server.ts` / the checkout screen, which display the server's
  // `shipping_amount`/`total_amount` verbatim).
  subtotal: number;
}

// Shape returned by `store/cart/` and `store/cart/merge/` (CartItemSerializer
// -- a *server*-persisted cart line for a signed-in user).
export interface ServerCartLine {
  variant_id: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  sku: string;
  size: string;
  color: string;
  unit_price: string;
  stock_quantity: number;
  quantity: number;
}
