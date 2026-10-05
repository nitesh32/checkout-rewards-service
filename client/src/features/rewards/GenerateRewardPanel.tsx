import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { describeError, milestoneProgressOf } from '@/lib/errors';
import { useGenerateReward } from './rewardsApi';

function ordersLabel(count: number): string {
  return `${count} order${count === 1 ? '' : 's'}`;
}

/**
 * The assignment's administrator operation, surfaced on the Rewards page so it can be tried
 * without Swagger. There is no authentication in this project; a real store would gate it.
 */
export function GenerateRewardPanel() {
  const generate = useGenerateReward();
  const progress = milestoneProgressOf(generate.error);

  return (
    <section
      aria-labelledby="generate-reward-heading"
      className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="generate-reward-heading" className="text-[15px] font-medium">
            Admin: generate a reward
          </h2>
          <p className="text-sm text-muted-foreground">
            Creates the reward for the next order milestone that has been reached. In a real store
            this sits behind an admin login.
          </p>
        </div>
        <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
          <Sparkles /> {generate.isPending ? 'Generating…' : 'Generate reward'}
        </Button>
      </div>

      <div role="status" aria-live="polite" className="text-sm">
        {generate.isSuccess && (
          <p className="font-medium text-success">
            Created <span className="font-mono">{generate.data.code}</span>:{' '}
            {generate.data.percentOff}% off. It is listed below.
          </p>
        )}
        {progress && (
          <p className="text-muted-foreground">
            No reward is due yet: {ordersLabel(progress.placedOrders)} placed, the next reward
            unlocks at order {progress.nextMilestoneAt} (
            {ordersLabel(progress.nextMilestoneAt - progress.placedOrders)} to go).
          </p>
        )}
        {generate.isError && !progress && (
          <p className="text-danger">{describeError(generate.error).description}</p>
        )}
      </div>
    </section>
  );
}
