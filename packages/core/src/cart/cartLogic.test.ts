import { addLine, cartTotals, removeLine, updateQuantity } from './cartLogic';
import { CartLine } from './types';

function line(overrides: Partial<CartLine> = {}): Omit<CartLine, 'quantity'> {
  return {
    variantId: 11,
    productId: 1,
    productSlug: 'cotton-panjabi',
    productName: 'Cotton Panjabi',
    sku: 'CP-M',
    size: 'M',
    color: 'White',
    unitPrice: '999.00',
    stockQuantity: 5,
    requiresPrescription: false,
    image: null,
    ...overrides,
  };
}

describe('addLine — variant identity', () => {
  test('adding the same variant twice increments quantity on one line', () => {
    let lines = addLine([], line(), 1);
    lines = addLine(lines, line(), 2);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
  });

  test('the same product in a different size is a separate line', () => {
    const lines = addLine(
      addLine([], line({ variantId: 11, size: 'M' }), 1),
      line({ variantId: 12, size: 'L' }),
      1,
    );
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.size).sort()).toEqual(['L', 'M']);
  });

  test('defaults quantity to 1', () => {
    const lines = addLine([], line());
    expect(lines[0].quantity).toBe(1);
  });
});

describe('updateQuantity', () => {
  test('updates the quantity of the matching variant line only', () => {
    const lines = addLine(addLine([], line({ variantId: 11 })), line({ variantId: 12, size: 'L' }));
    const updated = updateQuantity(lines, 11, 5);
    expect(updated.find((l) => l.variantId === 11)?.quantity).toBe(5);
    expect(updated.find((l) => l.variantId === 12)?.quantity).toBe(1);
  });

  test('quantity 0 removes the line', () => {
    const lines = addLine([], line());
    expect(updateQuantity(lines, 11, 0)).toHaveLength(0);
  });

  test('a negative quantity also removes the line', () => {
    const lines = addLine([], line());
    expect(updateQuantity(lines, 11, -3)).toHaveLength(0);
  });
});

describe('removeLine', () => {
  test('removes only the targeted variant', () => {
    const lines = addLine(addLine([], line({ variantId: 11 })), line({ variantId: 12, size: 'L' }));
    const result = removeLine(lines, 11);
    expect(result).toHaveLength(1);
    expect(result[0].variantId).toBe(12);
  });
});

describe('cartTotals', () => {
  test('sums subtotal and item count across lines, using the discounted effective price', () => {
    const lines = addLine(
      addLine([], line({ variantId: 11, unitPrice: '999.00' }), 2), // discounted line: 2 * 999
      line({ variantId: 12, size: 'L', unitPrice: '1200.00' }),
      1,
    ); // full-price line: 1 * 1200
    const totals = cartTotals(lines);
    expect(totals.itemCount).toBe(3);
    expect(totals.subtotal).toBeCloseTo(999 * 2 + 1200 * 1);
  });

  test('is zero for an empty cart', () => {
    expect(cartTotals([])).toEqual({ itemCount: 0, subtotal: 0 });
  });
});
