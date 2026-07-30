// Exercises the CartStorage contract against an in-memory fake -- the real
// `makeSecureCartStorage()` is a thin wrapper over `expo-secure-store`
// (already covered by that library's own tests) and isn't reachable outside
// a native runtime, so this pins the *shape* every implementation must honor:
// round-tripping lines, and clear() resetting to empty.
import { CartStorage } from './storage';
import { CartLine } from './types';

function makeInMemoryCartStorage(): CartStorage {
  let raw: string | null = null;
  return {
    async load() {
      if (!raw) return [];
      return JSON.parse(raw);
    },
    async save(lines) {
      raw = JSON.stringify(lines);
    },
    async clear() {
      raw = null;
    },
  };
}

const sampleLine: CartLine = {
  variantId: 11,
  productId: 1,
  productSlug: 'cotton-panjabi',
  productName: 'Cotton Panjabi',
  sku: 'CP-M',
  size: 'M',
  color: 'White',
  unitPrice: '999.00',
  quantity: 2,
  stockQuantity: 5,
  requiresPrescription: false,
  image: null,
};

test('persistence round-trip: save then load returns the same lines', async () => {
  const storage = makeInMemoryCartStorage();
  await storage.save([sampleLine]);
  const loaded = await storage.load();
  expect(loaded).toEqual([sampleLine]);
});

test('load on an empty store returns an empty array, not null/undefined', async () => {
  const storage = makeInMemoryCartStorage();
  expect(await storage.load()).toEqual([]);
});

test('clear resets to an empty cart', async () => {
  const storage = makeInMemoryCartStorage();
  await storage.save([sampleLine]);
  await storage.clear();
  expect(await storage.load()).toEqual([]);
});
