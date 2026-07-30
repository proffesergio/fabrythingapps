import { act, create } from 'react-test-renderer';
import { CartProvider, useCart, CartContextValue } from './CartProvider';
import { CartStorage } from './storage';
import { CartLine } from './types';

function makeMemoryStorage(initial: CartLine[] = []): CartStorage & { saved: CartLine[][] } {
  let lines = initial;
  const saved: CartLine[][] = [];
  return {
    saved,
    async load() {
      return lines;
    },
    async save(next) {
      lines = next;
      saved.push(next);
    },
    async clear() {
      lines = [];
    },
  };
}

function Probe({ onState }: { onState: (s: CartContextValue) => void }) {
  const state = useCart();
  onState(state);
  return null;
}

async function renderCart(storage: CartStorage) {
  let latest!: CartContextValue;
  await act(async () => {
    create(
      <CartProvider storage={storage}>
        <Probe onState={(s) => { latest = s; }} />
      </CartProvider>,
    );
  });
  return () => latest;
}

const sampleLine: Omit<CartLine, 'quantity'> = {
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
};

test('hydrates lines from storage on mount', async () => {
  const storage = makeMemoryStorage([{ ...sampleLine, quantity: 2 }]);
  const get = await renderCart(storage);
  expect(get().loading).toBe(false);
  expect(get().lines).toHaveLength(1);
  expect(get().totals).toEqual({ itemCount: 2, subtotal: 999 * 2 });
});

test('starts empty when nothing is stored', async () => {
  const storage = makeMemoryStorage([]);
  const get = await renderCart(storage);
  expect(get().lines).toEqual([]);
  expect(get().totals).toEqual({ itemCount: 0, subtotal: 0 });
});

test('addItem, updateQuantity and removeItem update state and persist', async () => {
  const storage = makeMemoryStorage([]);
  const get = await renderCart(storage);

  await act(async () => {
    get().addItem(sampleLine, 1);
  });
  expect(get().lines).toHaveLength(1);
  expect(storage.saved.at(-1)).toEqual([{ ...sampleLine, quantity: 1 }]);

  await act(async () => {
    get().updateQuantity(11, 4);
  });
  expect(get().lines[0].quantity).toBe(4);

  await act(async () => {
    get().removeItem(11);
  });
  expect(get().lines).toHaveLength(0);
  expect(storage.saved.at(-1)).toEqual([]);
});

test('clear empties the cart', async () => {
  const storage = makeMemoryStorage([{ ...sampleLine, quantity: 3 }]);
  const get = await renderCart(storage);
  await act(async () => {
    get().clear();
  });
  expect(get().lines).toEqual([]);
});

test('replaceAll swaps in a full line set (used after merge-on-login)', async () => {
  const storage = makeMemoryStorage([{ ...sampleLine, quantity: 1 }]);
  const get = await renderCart(storage);
  await act(async () => {
    get().replaceAll([{ ...sampleLine, variantId: 99, quantity: 7 }]);
  });
  expect(get().lines).toEqual([{ ...sampleLine, variantId: 99, quantity: 7 }]);
});
