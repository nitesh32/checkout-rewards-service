import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Margin Rewards are the backend's coupons: one is made available after every few placed orders.
 * There are no customer accounts, so every available reward is open to any shopper. Best first.
 */
export function useAvailableRewards() {
  return useQuery({
    queryKey: queryKeys.rewards,
    queryFn: async ({ signal }) => (await unwrap(api.GET('/rewards', { signal }))).data,
  });
}
