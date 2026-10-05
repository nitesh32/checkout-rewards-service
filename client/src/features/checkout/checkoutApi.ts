import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { Cart } from '@/lib/apiTypes';
import { cartIdStore } from '@/lib/cartStore';
import { queryKeys } from '@/lib/queryKeys';

interface PlaceOrderInput {
  cartId: string;
  idempotencyKey: string;
  couponCode: string | undefined;
  expectedTotalMinor: number | undefined;
}

const HTTP_OK = 200;

/**
 * What checkout would charge for this cart, with an optional reward code. Read-only on the
 * server, so it is safe to ask before the customer commits; the order re-checks everything.
 */
export function quoteQueryOptions(cart: Cart, couponCode: string | null) {
  return queryOptions({
    queryKey: queryKeys.quote(cart.id, couponCode, cart.updatedAt),
    queryFn: async ({ signal }) =>
      (
        await unwrap(
          api.GET('/carts/{cartId}/quote', {
            params: { path: { cartId: cart.id }, query: couponCode ? { couponCode } : {} },
            signal,
          }),
        )
      ).data,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cartId,
      idempotencyKey,
      couponCode,
      expectedTotalMinor,
    }: PlaceOrderInput) => {
      const { data, response } = await unwrap(
        api.POST('/carts/{cartId}/checkout', {
          params: { path: { cartId }, header: { 'idempotency-key': idempotencyKey } },
          body: { couponCode, expectedTotalMinor },
        }),
      );
      // 201 is a new order; 200 means this exact request had already succeeded and was replayed.
      return { order: data, isReplay: response.status === HTTP_OK };
    },
    onSuccess: ({ order }) => {
      queryClient.setQueryData(queryKeys.order(order.id), order);
      // The cart is spent; the next "add to cart" starts a fresh one.
      cartIdStore.clear();
      // A reward used by this order is no longer available.
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards });
    },
    // After a failure the cart, its quote or the rewards on screen may be stale, so reload them.
    onError: (_error, { cartId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart(cartId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards });
    },
  });
}
