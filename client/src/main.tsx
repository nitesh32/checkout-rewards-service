import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { CartSheetProvider } from '@/features/cart/CartSheetContext';
import { productsQueryOptions } from '@/features/products/productsApi';
import { ApiError } from '@/lib/api';
import { router } from './router';
import './index.css';

const MAX_RETRIES = 2;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      // Only retry failures that may be temporary: no connection, or a server error.
      retry: (failureCount, error) =>
        failureCount < MAX_RETRIES &&
        error instanceof ApiError &&
        (error.status === 0 || error.status >= 500),
    },
  },
});

// On the shop, start fetching the catalogue now rather than after React's first render, so the
// product photos (the largest paint) are discovered sooner.
const SHOP_PATHS = ['/', '/products'];
if (SHOP_PATHS.includes(window.location.pathname)) {
  void queryClient.prefetchInfiniteQuery(productsQueryOptions);
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CartSheetProvider>
        <RouterProvider router={router} />
      </CartSheetProvider>
    </QueryClientProvider>
  </StrictMode>,
);
