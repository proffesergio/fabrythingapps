import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AuthProvider,
  CartProvider,
  FoodCartProvider,
  createApiClient,
  makeSecureCartStorage,
  makeSecureFoodCartStorage,
  makeSecureTokenStore,
} from '@fabrything/core';

const store = makeSecureTokenStore();
export const api = createApiClient(store);
const queryClient = new QueryClient();
const cartStorage = makeSecureCartStorage();
// A separate cart from the store's. The two surfaces check out against
// different endpoints with different rules (a food order is restaurant-scoped
// and delivery is server-quoted), so one shared cart could not represent both.
const foodCartStorage = makeSecureFoodCartStorage();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider api={api} store={store}>
        <CartProvider storage={cartStorage}>
          <FoodCartProvider storage={foodCartStorage}>{children}</FoodCartProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
