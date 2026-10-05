import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

/**
 * The administrator action from the assignment: create the reward for the earliest order
 * milestone that has been reached but not yet rewarded. Fails with NO_ELIGIBLE_MILESTONE otherwise.
 */
export function useGenerateReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await unwrap(api.POST('/admin/coupons'))).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.rewards }),
  });
}
