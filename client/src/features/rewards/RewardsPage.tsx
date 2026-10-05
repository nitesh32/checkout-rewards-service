import { Gift } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { buttonClasses } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RewardCode } from './RewardCode';
import { useAvailableRewards } from './rewardsApi';

export function RewardsPage() {
  const rewards = useAvailableRewards();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <title>Rewards · Margin</title>
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold leading-9 tracking-tight">Margin Rewards</h1>
        <p className="text-muted-foreground">
          Every few orders, a reward is made available: a single-use code for a percentage off your
          next order. Enter one at checkout.
        </p>
      </div>

      {rewards.isLoading && (
        <div className="flex flex-col gap-3" aria-label="Loading rewards">
          <Skeleton className="h-[74px] rounded-xl" />
          <Skeleton className="h-[74px] rounded-xl" />
        </div>
      )}
      {rewards.isError && (
        <ErrorState error={rewards.error} onRetry={() => void rewards.refetch()} />
      )}
      {rewards.isSuccess && rewards.data.length === 0 && (
        <EmptyState
          icon={Gift}
          title="No rewards available right now"
          description="A new one appears after enough orders have been placed."
          action={
            <Link to="/products" className={buttonClasses({ variant: 'outline' })}>
              Continue shopping
            </Link>
          }
        />
      )}
      {rewards.isSuccess && rewards.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rewards.data.map((reward) => (
            <RewardCode key={reward.code} reward={reward} />
          ))}
        </ul>
      )}
    </div>
  );
}
