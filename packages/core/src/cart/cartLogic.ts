import { CartLine, CartTotals } from './types';

// Pure, side-effect-free cart transitions -- no storage, no network. Kept
// separate from `CartProvider` so totals/identity/quantity rules are testable
// without React or mocking persistence.

// Adds a line, or increments quantity if a line for the same variant already
// exists. Variant identity (not product identity) is the merge key: the same
// product in a different size/color is a distinct line.
export function addLine(lines: CartLine[], line: Omit<CartLine, 'quantity'>, quantity = 1): CartLine[] {
  const existing = lines.find((l) => l.variantId === line.variantId);
  if (existing) {
    return lines.map((l) =>
      l.variantId === line.variantId ? { ...l, quantity: l.quantity + quantity } : l,
    );
  }
  return [...lines, { ...line, quantity }];
}

// Setting quantity to 0 or below removes the line -- there is no "0 quantity"
// line state to represent in the cart.
export function updateQuantity(lines: CartLine[], variantId: number, quantity: number): CartLine[] {
  if (quantity <= 0) return removeLine(lines, variantId);
  return lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l));
}

export function removeLine(lines: CartLine[], variantId: number): CartLine[] {
  return lines.filter((l) => l.variantId !== variantId);
}

export function cartTotals(lines: CartLine[]): CartTotals {
  return lines.reduce<CartTotals>(
    (acc, l) => ({
      itemCount: acc.itemCount + l.quantity,
      subtotal: acc.subtotal + Number(l.unitPrice) * l.quantity,
    }),
    { itemCount: 0, subtotal: 0 },
  );
}
