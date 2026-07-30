import * as SecureStore from 'expo-secure-store';
import { CartLine } from './types';

const KEY = 'fabrything.cart';

export interface CartStorage {
  load(): Promise<CartLine[]>;
  save(lines: CartLine[]): Promise<void>;
  clear(): Promise<void>;
}

// `expo-secure-store` is already a dependency (used for auth tokens, see
// `../auth/secureTokenStore.ts`) -- reused here instead of adding
// AsyncStorage, per the rule against adding a dependency that already has an
// in-repo equivalent. Cart payloads are a handful of lines, well within its
// per-item size limits.
export function makeSecureCartStorage(): CartStorage {
  return {
    async load() {
      const raw = await SecureStore.getItemAsync(KEY);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // Corrupt stored payload: treat as an empty cart rather than crash.
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
