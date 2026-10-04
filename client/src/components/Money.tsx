import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

interface MoneyProps {
  amountMinor: number;
  currency?: string;
  className?: string;
}

/** The only way amounts are rendered: tabular figures so columns of prices line up. */
export function Money({ amountMinor, currency, className }: MoneyProps) {
  return (
    <span className={cn('tabular-nums', className)}>{formatMoney(amountMinor, currency)}</span>
  );
}
