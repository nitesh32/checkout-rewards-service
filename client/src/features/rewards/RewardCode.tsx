import { Copy } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button, buttonClasses } from '@/components/ui/button';
import type { Reward } from '@/lib/apiTypes';

export function RewardCode({ reward }: { reward: Reward }) {
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(reward.code);
      toast.success('Code copied');
    } catch {
      toast.error('Could not copy the code', { description: reward.code });
    }
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-accent/60 bg-surface p-4">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-base font-medium tracking-wide">{reward.code}</p>
        <p className="text-sm text-muted-foreground">
          {reward.percentOff}% off your order · single use
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => void copyCode()}>
          <Copy /> Copy
        </Button>
        <Link
          to={`/checkout?reward=${encodeURIComponent(reward.code)}`}
          className={buttonClasses({ size: 'sm' })}
        >
          Use at checkout
        </Link>
      </div>
    </li>
  );
}
