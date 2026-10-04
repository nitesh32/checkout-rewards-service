import { Check } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { Money } from '@/components/Money';
import { StatusBadge } from '@/components/StatusBadge';
import { SummaryLine } from '@/components/SummaryLine';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/dateTime';
import { formatOrderNumber } from '@/lib/orderNumber';
import { useOrder } from './orderApi';

/** Checkout navigates here with `{ isReplay }` so we can tell the customer a retry was recognised. */
function isReplayNavigation(state: unknown): boolean {
  return (
    typeof state === 'object' && state !== null && 'isReplay' in state && state.isReplay === true
  );
}

function OrderSkeleton() {
  return (
    <div className="flex max-w-2xl flex-col gap-4" aria-label="Loading order">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function OrderPage() {
  const { orderId = '' } = useParams();
  const isReplay = isReplayNavigation(useLocation().state);
  const order = useOrder(orderId);

  if (order.isLoading) return <OrderSkeleton />;
  if (order.isError) return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;
  if (!order.data) return null;

  const { orderNumber, placedAt, status, items, subtotalMinor, discountMinor, totalMinor, coupon } =
    order.data;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <title>Order confirmed · Margin</title>
      <div className="flex flex-col gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="size-5" aria-hidden />
        </span>
        <h1 className="text-[28px] font-bold leading-9 tracking-tight">
          Thank you, order {formatOrderNumber(orderNumber)}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {isReplay && <Badge tone="accent">Replayed</Badge>}
          <span className="text-muted-foreground">Placed {formatDateTime(placedAt)}</span>
        </div>
      </div>
      {isReplay && (
        <p className="text-muted-foreground">
          This checkout had already succeeded, so your retry returned the original order. You were
          not charged twice.
        </p>
      )}

      <section aria-label="Items" className="rounded-xl border border-border bg-surface">
        <ul className="divide-y divide-border px-4">
          {items.map((item) => (
            <SummaryLine key={item.productId} {...item} />
          ))}
        </ul>
        <dl className="flex flex-col gap-2 border-t border-border p-4">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>
              <Money amountMinor={subtotalMinor} />
            </dd>
          </div>
          {coupon && (
            <div className="flex justify-between text-success">
              <dt>
                Reward {coupon.code} ({coupon.percentOff}% off)
              </dt>
              <dd>
                −<Money amountMinor={discountMinor} />
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <dt className="font-medium">Total</dt>
            <dd>
              <Money amountMinor={totalMinor} className="text-2xl font-semibold" />
            </dd>
          </div>
        </dl>
      </section>

      <Link to="/products" className={buttonClasses({ className: 'h-11 self-start px-6' })}>
        Continue shopping
      </Link>
    </div>
  );
}
