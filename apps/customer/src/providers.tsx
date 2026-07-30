import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, CartProvider, createApiClient, makeSecureCartStorage, makeSecureTokenStore } from '@fabrything/core';

const store = makeSecureTokenStore();
export const api = createApiClient(store);
const queryClient = new QueryClient();
const cartStorage = makeSecureCartStorage();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider api={api} store={store}>
        <CartProvider storage={cartStorage}>{children}</CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
