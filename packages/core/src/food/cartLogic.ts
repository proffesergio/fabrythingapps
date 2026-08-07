import { FoodCartLine, FoodCartTotals } from './types';

// Pure, side-effect-free food-cart transitions — no storage, no network, no
// React. Deliberately separate from the STORE cart (`../cart/`): a food order
// posts a single `restaurant_slug` and is priced with server-quoted delivery,
// so the two carts share no rules and merging them would only couple them.

/** Identity of a cart line: the item plus the exact option set chosen.
 *  Options are sorted so selection order can never split one line into two. */
export function lineKey(line: Pick<FoodCartLine, 'itemId' | 'optionIds'>): string {
  return `${line.itemId}:${[...line.optionIds].sort((a, b) => a - b).join(',')}`;
}

function unitWithOptions(line: FoodCartLine): number {
  return line.optionLabels.reduce(
    (sum, o) => sum + Number(o.price_delta),
    Number(line.unitPrice),
  );
}

/**
 * Add an item, merging into an existing line when item + options match.
 *
 * Adding from a DIFFERENT restaurant replaces the whole cart. `place_food_cod_order`
 * takes one restaurant_slug and validates every item belongs to it, so a mixed
 * cart is unsubmittable — better to enforce it here than to surface it as a 400
 * after the customer has filled in a delivery address. Callers should warn
 * before calling when the cart is non-empty.
 */
export function addFoodLine(
  lines: FoodCartLine[],
  line: Omit<FoodCartLine, 'quantity'>,
  quantity = 1,
): FoodCartLine[] {
  const switching = lines.length > 0 && lines[0].restaurantSlug !== line.restaurantSlug;
  if (switching) return [{ ...line, quantity }];

  const key = lineKey(line);
  if (lines.some((l) => lineKey(l) === key)) {
    return lines.map((l) => (lineKey(l) === key ? { ...l, quantity: l.quantity + quantity } : l));
  }
  return [...lines, { ...line, quantity }];
}

/** Setting a quantity to zero or less removes the line — there is no zero state. */
export function updateFoodQuantity(
  lines: FoodCartLine[],
  key: string,
  quantity: number,
): FoodCartLine[] {
  if (quantity <= 0) return removeFoodLine(lines, key);
  return lines.map((l) => (lineKey(l) === key ? { ...l, quantity } : l));
}

export function removeFoodLine(lines: FoodCartLine[], key: string): FoodCartLine[] {
  return lines.filter((l) => lineKey(l) !== key);
}

export function foodCartTotals(lines: FoodCartLine[]): FoodCartTotals {
  return lines.reduce<FoodCartTotals>(
    (acc, l) => ({
      itemCount: acc.itemCount + l.quantity,
      subtotal: acc.subtotal + unitWithOptions(l) * l.quantity,
    }),
    { itemCount: 0, subtotal: 0 },
  );
}

/** The slug every line belongs to, or null for an empty cart. */
export function cartRestaurantSlug(lines: FoodCartLine[]): string | null {
  return lines.length ? lines[0].restaurantSlug : null;
}

/** Cart lines in the shape `POST food/orders/` expects. */
export function toOrderItems(lines: FoodCartLine[]) {
  return lines.map((l) => ({
    item_id: l.itemId,
    quantity: l.quantity,
    option_ids: l.optionIds,
  }));
}
