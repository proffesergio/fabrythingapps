import * as SecureStore from 'expo-secure-store';
import { FoodCartLine } from './types';

// A separate key from the store cart (`fabrything.cart`). The two carts are
// independent: a customer can have shirts in one and biryani in the other, and
// clearing one must never touch the other.
const KEY = 'fabrything.foodcart';

export interface FoodCartStorage {
  load(): Promise<FoodCartLine[]>;
  save(lines: FoodCartLine[]): Promise<void>;
  clear(): Promise<void>;
}

export function makeSecureFoodCartStorage(): FoodCartStorage {
  return {
    async load() {
      const raw = await SecureStore.getItemAsync(KEY);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // Corrupt payload: an empty cart beats a crash on launch.
        return [];
      }
    },
    async save(lines) {
      await SecureStore.setItemAsync(KEY, JSON.stringify(lines));
    },
    async clear() {
      await SecureStore.deleteItemAsync(KEY);
    },
  };
}
