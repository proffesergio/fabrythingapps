import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, createApiClient, makeSecureTokenStore } from '@fabrything/core';

const store = makeSecureTokenStore();
export const api = createApiClient(store);
const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider api={api} store={store}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
