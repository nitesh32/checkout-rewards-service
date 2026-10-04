import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { cartIdStore } from '@/lib/cartStore';
import { queryKeys } from '@/lib/queryKeys';

interface PlaceOrderInput {
  cartId: string;
  idempotencyKey: string;
  couponCode: string | undefined;
  expectedTotalMinor: number | undefined;
}

const HTTP_OK = 200;

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
    },
    // After a failure the cart on screen may be stale (stock or prices moved), so reload it.
    onError: (_error, { cartId }) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.cart(cartId) }),
  });
}
