import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/components/AppShell';
import { NotFoundPage } from '@/components/NotFoundPage';
import { ProductsPage } from '@/features/products/ProductsPage';

// The shop is the landing page and ships in the main bundle; other pages load when first visited.
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/products" replace /> },
      { path: 'products', element: <ProductsPage /> },
      {
        path: 'checkout',
        lazy: () =>
          import('@/features/checkout/CheckoutPage').then((module) => ({
            Component: module.CheckoutPage,
          })),
      },
      {
        path: 'rewards',
        lazy: () =>
          import('@/features/rewards/RewardsPage').then((module) => ({
            Component: module.RewardsPage,
          })),
      },
      {
        path: 'orders/:orderId',
        lazy: () =>
          import('@/features/orders/OrderPage').then((module) => ({ Component: module.OrderPage })),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
