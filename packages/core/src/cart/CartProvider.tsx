import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CartLine, CartTotals } from './types';
import { CartStorage } from './storage';
import { addLine, cartTotals, removeLine, updateQuantity as updateQty } from './cartLogic';

export interface CartContextValue {
  lines: CartLine[];
  loading: boolean;
  totals: CartTotals;
  addItem: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  updateQuantity: (variantId: number, quantity: number) => void;
  removeItem: (variantId: number) => void;
  clear: () => void;
  // Wholesale replace (used after merge-on-login to seed from the server's
  // response, or from any other future full-cart sync).
  replaceAll: (lines: CartLine[]) => void;
}

const Ctx = createContext<CartContextValue | null>(null);

export function CartProvider({ storage, children }: { storage: CartStorage; children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await storage.load();
      if (!cancelled) {
        setLines(stored);
        hydrated.current = true;
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage]);

  // Persist on every change, but only once the initial load has resolved --
  // otherwise the empty initial state would race the load and overwrite
  // whatever was already on disk.
  useEffect(() => {
    if (!hydrated.current) return;
    storage.save(lines);
  }, [lines, storage]);

  const addItem = useCallback((line: Omit<CartLine, 'quantity'>, quantity = 1) => {
    setLines((prev) => addLine(prev, line, quantity));
  }, []);
  const updateQuantity = useCallback((variantId: number, quantity: number) => {
    setLines((prev) => updateQty(prev, variantId, quantity));
  }, []);
  const removeItem = useCallback((variantId: number) => {
    setLines((prev) => removeLine(prev, variantId));
  }, []);
  const clear = useCallback(() => setLines([]), []);
  const replaceAll = useCallback((next: CartLine[]) => setLines(next), []);

  return (
    <Ctx.Provider
      value={{ lines, loading, totals: cartTotals(lines), addItem, updateQuantity, removeItem, clear, replaceAll }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCart(): CartContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCart must be used within CartProvider');
  return v;
}
