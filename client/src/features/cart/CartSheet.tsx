import { Minus, Plus, ShoppingBag, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Money } from '@/components/Money';
import { ProductImage } from '@/components/ProductImage';
import { Button, buttonClasses } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type { CartLine } from '@/lib/apiTypes';
import { useCart, useRemoveItem, useSetQuantity } from './cartApi';
import { useCartSheet } from './CartSheetContext';

const MAX_LINE_QUANTITY = 100;

function CartLineItem({ line }: { line: CartLine }) {
  const setQuantity = useSetQuantity();
  const removeItem = useRemoveItem();
  const isBusy = setQuantity.isPending || removeItem.isPending;
  const maxQuantity = Math.min(MAX_LINE_QUANTITY, line.availableStock);
  const isAtMaxQuantity = line.quantity >= maxQuantity;

  return (
    <li className="flex gap-4 py-4">
      <ProductImage sku={line.sku} className="aspect-auto h-20 w-16 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium leading-[22px]">{line.name}</p>
            <p className="text-xs text-muted-foreground">
              <Money amountMinor={line.unitPriceMinor} /> each
            </p>
          </div>
          <Money amountMinor={line.lineTotalMinor} className="font-semibold" />
        </div>

        {!line.isPurchasable && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <TriangleAlert className="size-3.5" aria-hidden />
            {line.availableStock === 0 ? 'Sold out' : `Only ${line.availableStock} available`}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label={`Quantity of ${line.name}`}
          >
            <Button
              variant="outline"
              size="iconSm"
              aria-label={`Decrease quantity of ${line.name}`}
              disabled={isBusy || line.quantity <= 1}
              onClick={() =>
                setQuantity.mutate({ productId: line.productId, quantity: line.quantity - 1 })
              }
            >
              <Minus />
            </Button>
            <span className="w-8 text-center tabular-nums">{line.quantity}</span>
            <Button
              variant="outline"
              size="iconSm"
              aria-label={`Increase quantity of ${line.name}`}
              title={isAtMaxQuantity ? `Only ${line.availableStock} available` : undefined}
              disabled={isBusy || isAtMaxQuantity}
              onClick={() =>
                setQuantity.mutate({ productId: line.productId, quantity: line.quantity + 1 })
              }
            >
              <Plus />
            </Button>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => removeItem.mutate(line.productId)}
            className="inline-flex items-center rounded-sm px-1 text-xs coarse:min-h-11 coarse:px-2 text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function CartSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4" aria-label="Loading cart">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex gap-4">
          <Skeleton className="h-20 w-16" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CartBody() {
  const cart = useCart();
  const { setOpen } = useCartSheet();

  if (cart.isLoading) return <CartSkeleton />;
  if (cart.isError) {
    return (
      <div className="p-4">
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
      </div>
    );
  }
  if (!cart.data || cart.data.lines.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Find something good for your desk."
          action={
            <Link
              to="/products"
              className={buttonClasses({ variant: 'outline' })}
              onClick={() => setOpen(false)}
            >
              Continue shopping
            </Link>
          }
        />
      </div>
    );
  }

  const { lines, subtotalMinor } = cart.data;
  const hasUnavailableLine = lines.some((line) => !line.isPurchasable);

  return (
    <>
      <ul className="flex-1 divide-y divide-border overflow-y-auto px-4">
        {lines.map((line) => (
          <CartLineItem key={line.productId} line={line} />
        ))}
      </ul>
      <div className="flex flex-col gap-3 border-t border-border bg-surface p-4">
        {hasUnavailableLine && (
          <p className="flex items-start gap-2 text-sm text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Some items are short on stock. Adjust them before checking out.
          </p>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <Money amountMinor={subtotalMinor} className="text-lg font-semibold" />
        </div>
        <p className="text-xs text-muted-foreground">Rewards are applied at checkout.</p>
        <Link
          to="/checkout"
          className={buttonClasses({ className: 'h-12 w-full text-base' })}
          onClick={() => setOpen(false)}
        >
          Checkout
        </Link>
      </div>
    </>
  );
}

export function CartSheet() {
  const { isOpen, setOpen } = useCartSheet();
  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-xl font-bold">Your cart</SheetTitle>
          <SheetDescription>Review your items before checking out.</SheetDescription>
        </SheetHeader>
        <CartBody />
      </SheetContent>
    </Sheet>
  );
}
