import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FoodCartLine, FoodCartTotals } from './types';
import { FoodCartStorage } from './storage';
import {
  addFoodLine,
  cartRestaurantSlug,
  foodCartTotals,
  removeFoodLine,
  updateFoodQuantity,
} from './cartLogic';

export interface FoodCartContextValue {
  lines: FoodCartLine[];
  loading: boolean;
  totals: FoodCartTotals;
  /** Slug every line belongs to, or null when empty. */
  restaurantSlug: string | null;
  /** True when adding from `slug` would wipe the cart (different restaurant). */
  wouldReplaceCart: (slug: string) => boolean;
  addItem: (line: Omit<FoodCartLine, 'quantity'>, quantity?: number) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const Ctx = createContext<FoodCartContextValue | null>(null);

export function FoodCartProvider({
  storage,
  children,
}: {
  storage: FoodCartStorage;
  children: React.ReactNode;
}) {
  const [lines, setLines] = useState<FoodCartLine[]>([]);
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

  // Persist only after hydration, or the empty initial state races the load
  // and overwrites a cart that was already on disk.
  useEffect(() => {
    if (!hydrated.current) return;
    storage.save(lines);
  }, [lines, storage]);

  const addItem = useCallback((line: Omit<FoodCartLine, 'quantity'>, quantity = 1) => {
    setLines((cur) => addFoodLine(cur, line, quantity));
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setLines((cur) => updateFoodQuantity(cur, key, quantity));
  }, []);

  const removeItem = useCallback((key: string) => {
    setLines((cur) => removeFoodLine(cur, key));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    storage.clear();
  }, [storage]);

  const slug = cartRestaurantSlug(lines);
  const wouldReplaceCart = useCallback(
    (next: string) => lines.length > 0 && lines[0].restaurantSlug !== next,
    [lines],
  );

  return (
    <Ctx.Provider
      value={{
        lines,
        loading,
        totals: foodCartTotals(lines),
        restaurantSlug: slug,
        wouldReplaceCart,
        addItem,
        updateQuantity,
        removeItem,
        clear,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useFoodCart(): FoodCartContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFoodCart must be used inside a FoodCartProvider');
  return ctx;
}
