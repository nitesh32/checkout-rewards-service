import { ChevronDown, ShoppingBag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Money } from '@/components/Money';
import { Button, buttonClasses } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SummaryLine } from '@/components/SummaryLine';
import { ApiError } from '@/lib/api';
import type { Cart } from '@/lib/apiTypes';
import { cartIdStore } from '@/lib/cartStore';
import { describeError } from '@/lib/errors';
import { useCart } from '../cart/cartApi';
import { useCartSheet } from '../cart/CartSheetContext';
import { quoteQueryOptions, usePlaceOrder } from './checkoutApi';
import { CheckoutErrorPanel } from './CheckoutErrorPanel';
import { checkoutFingerprint, createIdempotencyKeyProvider } from './idempotencyKey';
import { normalizeRewardCode, RewardOffer } from './RewardOffer';

const COUPON_ERROR_CODES = ['COUPON_NOT_FOUND', 'COUPON_ALREADY_REDEEMED'];

function isCouponError(error: unknown): error is ApiError {
  return error instanceof ApiError && COUPON_ERROR_CODES.includes(error.code);
}

export function CheckoutPage() {
  const cart = useCart();
  const [searchParams] = useSearchParams();

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

  // "Use at checkout" on the Rewards page links here with ?reward=CODE.
  const rewardFromLink = normalizeRewardCode(searchParams.get('reward') ?? '') || null;
  return <CheckoutForm cart={cart.data} initialRewardCode={rewardFromLink} />;
}

function CheckoutForm({
  cart,
  initialRewardCode,
}: {
  cart: Cart;
  initialRewardCode: string | null;
}) {
  const placeOrder = usePlaceOrder();
  const navigate = useNavigate();
  const { setOpen: setCartSheetOpen } = useCartSheet();
  const [keyFor] = useState(createIdempotencyKeyProvider);

  const [appliedCode, setAppliedCode] = useState<string | null>(initialRewardCode);
  const [rewardNotice, setRewardNotice] = useState<string | null>(null);
  // Set when the customer accepts a changed total (PRICE_CHANGED); replaces the quoted total.
  const [acceptedTotalMinor, setAcceptedTotalMinor] = useState<number | undefined>();

  const appliedQuote = useQuery({
    ...quoteQueryOptions(cart, appliedCode),
    enabled: appliedCode !== null,
  });
  const activeQuote = appliedCode !== null && appliedQuote.isSuccess ? appliedQuote.data : null;
  const unusableCodeNotice =
    appliedCode !== null && appliedQuote.isError
      ? `${appliedCode} can't be used. ${describeError(appliedQuote.error).description}`
      : null;

  const { id: cartId, lines, subtotalMinor } = cart;
  const couponCode = activeQuote?.coupon?.code;
  const discountMinor = activeQuote?.discountMinor ?? 0;
  const totalMinor = acceptedTotalMinor ?? activeQuote?.totalMinor ?? subtotalMinor;
  // While a code is being checked, the total is not final yet, so ordering waits.
  const isConfirmingTotal = appliedCode !== null && appliedQuote.isFetching;

  const changeReward = (code: string | null) => {
    setAppliedCode(code);
    setRewardNotice(null);
    setAcceptedTotalMinor(undefined);
    placeOrder.reset();
  };

  const submit = (totalToExpect: number) => {
    const idempotencyKey = keyFor(
      checkoutFingerprint({ cartId, couponCode, expectedTotalMinor: totalToExpect }),
    );
    // mutateAsync, not mutate with callbacks: a successful order clears the cart, which unmounts
    // this form, and TanStack Query skips per-call callbacks of unmounted components.
    placeOrder
      .mutateAsync({ cartId, idempotencyKey, couponCode, expectedTotalMinor: totalToExpect })
      .then(
        ({ order, isReplay }) => navigate(`/orders/${order.id}`, { state: { isReplay } }),
        (error: unknown) => {
          // The code was used by another order between Apply and now: drop it and say why.
          if (isCouponError(error) && couponCode) {
            setAppliedCode(null);
            setRewardNotice(
              `${couponCode} was just used on another order, so it has been removed. ` +
                'Your total has been updated.',
            );
          }
        },
      );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(totalMinor);
  };

  const handleAcceptNewTotal = (newTotalMinor: number) => {
    setAcceptedTotalMinor(newTotalMinor);
    submit(newTotalMinor);
  };

  const error = placeOrder.error;

  return (
    <div className="flex flex-col gap-6">
      <title>Checkout · Margin</title>
      <h1 className="text-[28px] font-bold leading-9 tracking-tight">Checkout</h1>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6 lg:order-1">
          <RewardOffer
            cart={cart}
            appliedQuote={activeQuote}
            notice={rewardNotice ?? unusableCodeNotice}
            onApply={changeReward}
            onRemove={() => changeReward(null)}
          />

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {error && !isCouponError(error) && (
              <CheckoutErrorPanel
                error={error}
                cartLines={lines}
                onReviewCart={() => setCartSheetOpen(true)}
                onAcceptNewTotal={handleAcceptNewTotal}
                onRetry={() => submit(totalMinor)}
                onLeaveCheckedOutCart={() => cartIdStore.clear()}
              />
            )}

            <Button
              type="submit"
              disabled={placeOrder.isPending || isConfirmingTotal}
              className="h-12 text-base lg:self-start lg:px-10"
            >
              {placeOrder.isPending ? (
                'Placing order…'
              ) : (
                // The amount on the button, as production apps do, so the total is visible on
                // phones where the summary sits below.
                <>
                  Place order · <Money amountMinor={totalMinor} />
                </>
              )}
            </Button>
          </form>
        </div>

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
              {activeQuote?.coupon && (
                <div className="flex justify-between text-success">
                  <dt>
                    Reward <span className="font-mono">{activeQuote.coupon.code}</span>
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
              {discountMinor > 0 && (
                <p className="rounded-md bg-success/10 px-3 py-2 text-center text-sm font-medium text-success">
                  You're saving <Money amountMinor={discountMinor} /> on this order
                </p>
              )}
            </dl>
          </div>
        </details>
      </div>
    </div>
  );
}
