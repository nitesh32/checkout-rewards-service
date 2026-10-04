import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

const MAX_REWARDS = 100;

/**
 * Margin Rewards are the backend's coupons: one is made available after every few placed orders.
 * The API has no customer accounts, so every available coupon is open to any shopper.
 */
export function useAvailableRewards() {
  return useQuery({
    queryKey: queryKeys.availableRewards,
    queryFn: async () => {
      const { data } = await unwrap(
        api.GET('/admin/coupons', {
          params: { query: { status: 'AVAILABLE', limit: MAX_REWARDS } },
        }),
      );
      return data.data;
    },
  });
}
