import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: queryKeys.order(orderId),
    queryFn: async () => {
      const { data } = await unwrap(
        api.GET('/orders/{orderId}', { params: { path: { orderId } } }),
      );
      return data;
    },
  });
}
