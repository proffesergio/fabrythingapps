// Mirrors `FoodOrder.ALLOWED_TRANSITIONS` in
// ../fabrythingweb/backend/EcommerceInventory/food/models.py. The server is
// authoritative — `transition_to()` is the single choke point and will reject
// an illegal jump with a 400. This table exists only so the apps can avoid
// OFFERING a button that would certainly fail; never treat it as permission.
export const FOOD_STATUS = {
  PLACED: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type FoodStatus = (typeof FOOD_STATUS)[keyof typeof FOOD_STATUS];

const ALLOWED: Record<string, FoodStatus[]> = {
  PLACED: [FOOD_STATUS.CONFIRMED, FOOD_STATUS.CANCELLED],
  CONFIRMED: [FOOD_STATUS.PREPARING, FOOD_STATUS.CANCELLED],
  PREPARING: [FOOD_STATUS.OUT_FOR_DELIVERY, FOOD_STATUS.CANCELLED],
  OUT_FOR_DELIVERY: [FOOD_STATUS.DELIVERED, FOOD_STATUS.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

export function nextStatuses(current: string): FoodStatus[] {
  return ALLOWED[current] ?? [];
}

/** The single forward step, ignoring cancellation — what a "Mark as ..." button
 *  should offer. Returns null at a terminal state. */
export function forwardStatus(current: string): FoodStatus | null {
  const next = nextStatuses(current).filter((s) => s !== FOOD_STATUS.CANCELLED);
  return next[0] ?? null;
}

export function isTerminal(current: string): boolean {
  return nextStatuses(current).length === 0;
}

/** Ordered stages for a progress timeline. CANCELLED is deliberately absent —
 *  it is not a stage, it is an exit, and rendering it inline would imply an
 *  order passes "through" cancellation on its way somewhere. */
export const FOOD_STATUS_FLOW: FoodStatus[] = [
  FOOD_STATUS.PLACED,
  FOOD_STATUS.CONFIRMED,
  FOOD_STATUS.PREPARING,
  FOOD_STATUS.OUT_FOR_DELIVERY,
  FOOD_STATUS.DELIVERED,
];
