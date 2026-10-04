import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Coupon } from '@/lib/apiTypes';

export function RewardCode({ coupon }: { coupon: Coupon }) {
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      toast.success('Code copied');
    } catch {
      toast.error('Could not copy the code', { description: coupon.code });
    }
  };

  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-base font-medium tracking-wide">{coupon.code}</p>
        <p className="text-sm text-muted-foreground">
          {coupon.percentOff}% off your order · single use
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => void copyCode()}>
        <Copy /> Copy
      </Button>
    </li>
  );
}
