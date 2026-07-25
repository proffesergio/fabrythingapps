import * as SecureStore from 'expo-secure-store';
import { TokenStore } from '../api/tokenStore';

const A = 'fabrything.access';
const R = 'fabrything.refresh';

export function makeSecureTokenStore(): TokenStore {
  return {
    getAccess: () => SecureStore.getItemAsync(A),
    getRefresh: () => SecureStore.getItemAsync(R),
    setTokens: async (access, refresh) => {
      await SecureStore.setItemAsync(A, access);
      await SecureStore.setItemAsync(R, refresh);
    },
    clear: async () => { await SecureStore.deleteItemAsync(A); await SecureStore.deleteItemAsync(R); },
  };
}
