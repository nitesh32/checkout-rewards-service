import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router';
import { Button, buttonClasses } from '@/components/ui/button';
import type { CartLine } from '@/lib/apiTypes';
import {
  describeError,
  describePriceChange,
  existingOrderIdOf,
  priceChangeOf,
  stockShortagesOf,
} from '@/lib/errors';

interface CheckoutErrorPanelProps {
  error: unknown;
  cartLines: CartLine[];
  onReviewCart: () => void;
  onAcceptNewTotal: (totalMinor: number) => void;
  onRetry: () => void;
  onLeaveCheckedOutCart: () => void;
}

function nameOfProduct(cartLines: CartLine[], productId: string): string {
  return cartLines.find((line) => line.productId === productId)?.name ?? 'An item';
}

export function CheckoutErrorPanel({
  error,
  cartLines,
  onReviewCart,
  onAcceptNewTotal,
  onRetry,
  onLeaveCheckedOutCart,
}: CheckoutErrorPanelProps) {
  const { title, description } = describeError(error);
  const shortages = stockShortagesOf(error);
  const priceChange = priceChangeOf(error);
  const existingOrderId = existingOrderIdOf(error);

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {shortages && (
        <ul className="flex flex-col gap-1 text-sm">
          {shortages.map((shortage) => (
            <li key={shortage.productId}>
              <span className="font-medium">{nameOfProduct(cartLines, shortage.productId)}</span>:
              you asked for {shortage.requested}, only {shortage.available} available.
            </li>
          ))}
        </ul>
      )}

      {priceChange && <p className="text-sm">{describePriceChange(priceChange)}</p>}

      <div className="flex flex-wrap gap-2">
        {shortages && (
          <Button variant="outline" size="sm" onClick={onReviewCart}>
            Review cart
          </Button>
        )}
        {priceChange && (
          <Button size="sm" onClick={() => onAcceptNewTotal(priceChange.actualTotalMinor)}>
            Accept new total and place order
          </Button>
        )}
        {existingOrderId && (
          <Link
            to={`/orders/${existingOrderId}`}
            className={buttonClasses({ size: 'sm' })}
            onClick={onLeaveCheckedOutCart}
          >
            View the order
          </Link>
        )}
        {!shortages && !priceChange && !existingOrderId && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
