import { ChevronDown, ShoppingBag } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Money } from '@/components/Money';
import { Button, buttonClasses } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SummaryLine } from '@/components/SummaryLine';
import { useAvailableRewards } from '../rewards/rewardsApi';
import { ApiError } from '@/lib/api';
import { cartIdStore } from '@/lib/cartStore';
import { describeError } from '@/lib/errors';
import { useCart } from '../cart/cartApi';
import { useCartSheet } from '../cart/CartSheetContext';
import { usePlaceOrder } from './checkoutApi';
import { CheckoutErrorPanel } from './CheckoutErrorPanel';
import { checkoutFingerprint, createIdempotencyKeyProvider } from './idempotencyKey';

const COUPON_ERROR_CODES = ['COUPON_NOT_FOUND', 'COUPON_ALREADY_REDEEMED'];

export function CheckoutPage() {
  const cart = useCart();
  const placeOrder = usePlaceOrder();
  const availableRewards = useAvailableRewards().data ?? [];
  const navigate = useNavigate();
  const { setOpen: setCartSheetOpen } = useCartSheet();

  const [couponInput, setCouponInput] = useState('');
  // Set when the customer accepts a changed total (PRICE_CHANGED); replaces the displayed subtotal.
  const [acceptedTotalMinor, setAcceptedTotalMinor] = useState<number | undefined>();
  const [keyFor] = useState(createIdempotencyKeyProvider);

  if (cart.isLoading) return <Skeleton className="h-96 w-full max-w-5xl" />;
  if (cart.isError) return <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />;
  if (!cart.data || cart.data.lines.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Nothing to check out"
        description="Add a product to your cart first."
        action={
          <Link to="/products" className={buttonClasses({ variant: 'outline' })}>
            Browse products
          </Link>
        }
      />
    );
  }

  const { id: cartId, lines, subtotalMinor } = cart.data;
  const couponCode = couponInput.trim().toUpperCase() || undefined;
  // With a coupon the discount is only known once the server applies it, so no total can be expected.
  const expectedTotalMinor = acceptedTotalMinor ?? (couponCode ? undefined : subtotalMinor);

  const submit = (totalToExpect: number | undefined) => {
    const idempotencyKey = keyFor(
      checkoutFingerprint({ cartId, couponCode, expectedTotalMinor: totalToExpect }),
    );
    placeOrder.mutate(
      { cartId, idempotencyKey, couponCode, expectedTotalMinor: totalToExpect },
      {
        onSuccess: ({ order, isReplay }) =>
          void navigate(`/orders/${order.id}`, { state: { isReplay } }),
      },
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(expectedTotalMinor);
  };

  const handleAcceptNewTotal = (totalMinor: number) => {
    setAcceptedTotalMinor(totalMinor);
    submit(totalMinor);
  };

  const handleCouponChange = (value: string) => {
    setCouponInput(value);
    setAcceptedTotalMinor(undefined);
    placeOrder.reset();
  };

  const error = placeOrder.error;
  const couponError =
    error instanceof ApiError && COUPON_ERROR_CODES.includes(error.code)
      ? describeError(error)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <title>Checkout · Margin</title>
      <h1 className="text-[28px] font-bold leading-9 tracking-tight">Checkout</h1>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 lg:order-1">
          <section
            aria-labelledby="rewards-heading"
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <h2 id="rewards-heading" className="text-[15px] font-medium">
              Margin Rewards
            </h2>
            <div className="flex flex-col gap-2">
              <label htmlFor="coupon" className="text-muted-foreground">
                Reward code (optional)
              </label>
              <Input
                id="coupon"
                value={couponInput}
                onChange={(event) => handleCouponChange(event.target.value)}
                placeholder="SAVE-XXXXXXXX"
                maxLength={64}
                autoComplete="off"
                aria-invalid={couponError !== null}
                aria-describedby={couponError ? 'coupon-error' : undefined}
                className="max-w-xs font-mono uppercase"
              />
              {couponError && (
                <p id="coupon-error" className="text-sm text-danger">
                  {couponError.description}
                </p>
              )}
            </div>
            {availableRewards.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">Available now</p>
                <ul className="flex flex-wrap gap-2">
                  {availableRewards.map((reward) => (
                    <li key={reward.id}>
                      <button
                        type="button"
                        aria-pressed={couponCode === reward.code}
                        onClick={() => handleCouponChange(reward.code)}
                        className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 coarse:min-h-11 font-mono text-xs transition-colors hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {reward.code} · {reward.percentOff}% off
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {error && !couponError && (
            <CheckoutErrorPanel
              error={error}
              cartLines={lines}
              onReviewCart={() => setCartSheetOpen(true)}
              onAcceptNewTotal={handleAcceptNewTotal}
              onRetry={() => submit(expectedTotalMinor)}
              onLeaveCheckedOutCart={() => cartIdStore.clear()}
            />
          )}

          <Button
            type="submit"
            disabled={placeOrder.isPending}
            className="h-12 text-base lg:self-start lg:px-10"
          >
            {placeOrder.isPending ? 'Placing order…' : 'Place order'}
          </Button>
        </form>

        <details
          open
          className="group rounded-xl border border-border bg-surface lg:sticky lg:top-24 lg:order-2"
        >
          <summary className="flex list-none items-center justify-between rounded-xl p-4 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:pointer-events-none lg:cursor-default [&::-webkit-details-marker]:hidden">
            Order summary
            <ChevronDown
              className="size-4 text-muted-foreground group-open:rotate-180 lg:hidden"
              aria-hidden
            />
          </summary>
          <div className="flex flex-col gap-3 border-t border-border p-4">
            <ul className="divide-y divide-border">
              {lines.map((line) => (
                <SummaryLine key={line.productId} {...line} />
              ))}
            </ul>
            <dl className="flex flex-col gap-2 border-t border-border pt-3">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>
                  <Money amountMinor={subtotalMinor} />
                </dd>
              </div>
              {couponCode && acceptedTotalMinor === undefined && (
                <div className="flex justify-between text-success">
                  <dt>Reward {couponCode}</dt>
                  <dd>Applied when you order</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <dt className="font-medium">Total</dt>
                <dd>
                  <Money
                    amountMinor={acceptedTotalMinor ?? subtotalMinor}
                    className="text-2xl font-semibold"
                  />
                </dd>
              </div>
            </dl>
          </div>
        </details>
      </div>
    </div>
  );
}
