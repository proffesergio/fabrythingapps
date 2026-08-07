import { addFoodLine, foodCartTotals, lineKey, removeFoodLine, updateFoodQuantity } from './cartLogic';
import { FoodCartLine } from './types';

const base: Omit<FoodCartLine, 'quantity'> = {
  itemId: 1,
  restaurantSlug: 'kabab-ghar',
  name: 'Chicken Biryani',
  image: null,
  unitPrice: '180.00',
  optionIds: [],
  optionLabels: [],
};

describe('line identity', () => {
  it('treats the same item with different options as different lines', () => {
    // The server prices a line as effective_price + sum(option deltas), so two
    // option sets are two different prices and cannot share a line.
    let lines = addFoodLine([], base);
    lines = addFoodLine(lines, { ...base, optionIds: [7] });
    expect(lines).toHaveLength(2);
  });

  it('merges quantities when the option set matches regardless of order', () => {
    let lines = addFoodLine([], { ...base, optionIds: [7, 3] });
    lines = addFoodLine(lines, { ...base, optionIds: [3, 7] });
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
  });

  it('ignores quantity, so a key stays stable as the count changes', () => {
    const one: FoodCartLine = { ...base, optionIds: [3, 7], quantity: 1 };
    const nine: FoodCartLine = { ...base, optionIds: [7, 3], quantity: 9 };
    expect(lineKey(one)).toBe(lineKey(nine));
  });
});

describe('one restaurant per cart', () => {
  // A food order posts ONE restaurant_slug. A cart mixing restaurants could
  // not be submitted at all, so the rule is enforced here rather than
  // discovered as a 400 at checkout.
  it('replaces the cart when an item from another restaurant is added', () => {
    const lines = addFoodLine([], base);
    const next = addFoodLine(lines, { ...base, itemId: 99, restaurantSlug: 'pizza-hub' });
    expect(next).toHaveLength(1);
    expect(next[0].restaurantSlug).toBe('pizza-hub');
    expect(next[0].itemId).toBe(99);
  });

  it('keeps existing lines when the restaurant matches', () => {
    let lines = addFoodLine([], base);
    lines = addFoodLine(lines, { ...base, itemId: 2, name: 'Naan' });
    expect(lines).toHaveLength(2);
  });
});

describe('quantities', () => {
  it('adds a requested quantity rather than always one', () => {
    const lines = addFoodLine([], base, 3);
    expect(lines[0].quantity).toBe(3);
  });

  it('removes the line when quantity drops to zero', () => {
    const lines = addFoodLine([], base);
    expect(updateFoodQuantity(lines, lineKey(lines[0]), 0)).toHaveLength(0);
  });

  it('removes by key', () => {
    let lines = addFoodLine([], base);
    lines = addFoodLine(lines, { ...base, itemId: 2 });
    expect(removeFoodLine(lines, lineKey(lines[0]))).toHaveLength(1);
  });
});

describe('totals', () => {
  it('adds option deltas on top of the unit price', () => {
    const lines = addFoodLine([], {
      ...base,
      optionIds: [7],
      optionLabels: [{ name: 'Extra cheese', price_delta: '20.00' }],
    }, 2);
    // (180 + 20) * 2
    expect(foodCartTotals(lines).subtotal).toBe(400);
    expect(foodCartTotals(lines).itemCount).toBe(2);
  });

  it('is zero for an empty cart', () => {
    expect(foodCartTotals([])).toEqual({ itemCount: 0, subtotal: 0 });
  });

  it('handles a negative delta without going below the item price floor', () => {
    const lines = addFoodLine([], {
      ...base,
      optionIds: [9],
      optionLabels: [{ name: 'No rice', price_delta: '-30.00' }],
    });
    expect(foodCartTotals(lines).subtotal).toBe(150);
  });
});
