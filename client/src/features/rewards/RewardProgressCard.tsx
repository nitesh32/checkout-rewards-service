import { Check, Gift } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { RewardProgress } from '@/lib/apiTypes';
import { cn } from '@/lib/utils';
import { useRewardProgress } from './rewardsApi';

/** Above this many orders per reward, a bar replaces the row of step circles. */
const MAX_STEP_CIRCLES = 8;

function ordinal(value: number): string {
  if (value % 100 >= 11 && value % 100 <= 13) return `${value}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] ?? 'th';
  return `${value}${suffix}`;
}

function headline({ isRewardDue, ordersLeft, percentOff }: RewardProgress): string {
  if (isRewardDue) return `Your ${percentOff}% reward is unlocked`;
  return `${ordersLeft} order${ordersLeft === 1 ? '' : 's'} left to unlock ${percentOff}% off`;
}

/** "Order 1 … Order n" circles joined by a line, filled up to the orders counted so far. */
function Steps({ everyNOrders, ordersTowardNext }: RewardProgress) {
  return (
    <ol className="flex">
      {Array.from({ length: everyNOrders }, (_, index) => {
        const isDone = index < ordersTowardNext;
        return (
          <li key={index} className="relative flex flex-1 flex-col items-center gap-1.5">
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  'absolute right-1/2 top-3.5 h-0.5 w-full',
                  isDone ? 'bg-accent' : 'bg-border',
                )}
              />
            )}
            <span
              className={cn(
                // z-10: above the line drawn by the next step, which comes later in the page.
                'relative z-10 flex size-7 items-center justify-center rounded-full border-2',
                isDone
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-input bg-surface',
              )}
            >
              {isDone && <Check className="size-4" strokeWidth={3} aria-hidden />}
            </span>
            <span className="text-xs text-muted-foreground">Order {index + 1}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Bar({ everyNOrders, ordersTowardNext }: RewardProgress) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${(ordersTowardNext / everyNOrders) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {ordersTowardNext} of {everyNOrders} orders
      </p>
    </div>
  );
}

/**
 * Milestone tracker, like "4 orders left to unlock…" in shopping apps. It counts orders since the
 * last reward, so it fills up towards the next one and starts again when an order unlocks it.
 */
export function RewardProgressCard() {
  const progress = useRewardProgress();
  if (progress.isLoading) return <Skeleton className="h-[148px] rounded-xl" />;
  if (!progress.data) return null;

  const data = progress.data;
  return (
    <section
      aria-label="Reward progress"
      className="overflow-hidden rounded-xl border border-border bg-surface"
    >
      <div className="flex items-center gap-3 bg-accent px-4 py-3 text-accent-foreground">
        <Gift className="size-5 shrink-0" aria-hidden />
        <p className="font-semibold" aria-live="polite">
          {headline(data)}
        </p>
      </div>
      <div
        className="px-4 pb-3 pt-4"
        role="progressbar"
        aria-label="Orders towards the next reward"
        aria-valuemin={0}
        aria-valuemax={data.everyNOrders}
        aria-valuenow={data.ordersTowardNext}
      >
        {data.everyNOrders <= MAX_STEP_CIRCLES ? <Steps {...data} /> : <Bar {...data} />}
      </div>
      <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        {data.isRewardDue ? 'Waiting for an admin to generate it. ' : ''}
        Every {data.everyNOrders === 1 ? 'order' : `${ordinal(data.everyNOrders)} order`} in the
        store unlocks a {data.percentOff}% reward automatically.
      </p>
    </section>
  );
}
