import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, unwrap } from '@/lib/api';
import type { Cart } from '@/lib/apiTypes';
import { cartIdStore, useCartId } from '@/lib/cartStore';
import { describeError } from '@/lib/errors';
import { queryKeys } from '@/lib/queryKeys';

/** The cart this browser is working on, or `null` before the first item is added. */
export function useCart() {
  const cartId = useCartId();
  return useQuery({
    queryKey: queryKeys.cart(cartId ?? ''),
    enabled: cartId !== null,
    queryFn: async () => {
      try {
        const { data } = await unwrap(
          api.GET('/carts/{cartId}', { params: { path: { cartId: cartId ?? '' } } }),
        );
        return data;
      } catch (error) {
        // The stored cart no longer exists (for example after a database reset).
        if (error instanceof ApiError && error.code === 'CART_NOT_FOUND') cartIdStore.clear();
        throw error;
      }
    },
  });
}

async function ensureCartId(): Promise<string> {
  const existing = cartIdStore.get();
  if (existing) return existing;
  const { data } = await unwrap(api.POST('/carts'));
  cartIdStore.set(data.id);
  return data.id;
}

/** Shared failure handling: forget carts that can no longer be edited, then tell the user. */
function handleCartError(error: unknown): void {
  if (error instanceof ApiError && ['CART_NOT_OPEN', 'CART_NOT_FOUND'].includes(error.code)) {
    cartIdStore.clear();
  }
  const { title, description } = describeError(error);
  toast.error(title, { description });
}

function useCartMutation<Variables>(
  request: (cartId: string, variables: Variables) => Promise<Cart>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: Variables) => request(await ensureCartId(), variables),
    onSuccess: (cart) => queryClient.setQueryData(queryKeys.cart(cart.id), cart),
    onError: handleCartError,
  });
}

export function useAddToCart() {
  return useCartMutation(async (cartId, body: { productId: string; quantity: number }) => {
    const { data } = await unwrap(
      api.POST('/carts/{cartId}/items', { params: { path: { cartId } }, body }),
    );
    return data;
  });
}

export function useSetQuantity() {
  return useCartMutation(async (cartId, line: { productId: string; quantity: number }) => {
    const { data } = await unwrap(
      api.PATCH('/carts/{cartId}/items/{productId}', {
        params: { path: { cartId, productId: line.productId } },
        body: { quantity: line.quantity },
      }),
    );
    return data;
  });
}

export function useRemoveItem() {
  return useCartMutation(async (cartId, productId: string) => {
    const { data } = await unwrap(
      api.DELETE('/carts/{cartId}/items/{productId}', {
        params: { path: { cartId, productId } },
      }),
    );
    return data;
  });
}
