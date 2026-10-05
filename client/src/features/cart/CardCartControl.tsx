import { Check } from 'lucide-react';
import type { Product } from '@/lib/apiTypes';
import { AddToCartButton } from './AddToCartButton';
import { useCart, useRemoveItem, useSetQuantity } from './cartApi';
import { QuantityStepper } from './QuantityStepper';

/**
 * The last row of a product card: "Add to cart" until the product is in the cart, then an
 * "In cart" row of the same height with a compact stepper, so the card never changes size.
 */
export function CardCartControl({ product }: { product: Product }) {
  const cart = useCart();
  const setQuantity = useSetQuantity();
  const removeItem = useRemoveItem();

  const quantity = cart.data?.lines.find((line) => line.productId === product.id)?.quantity ?? 0;
  if (product.stock === 0 || quantity === 0) {
    return <AddToCartButton product={product} className="w-full font-semibold" />;
  }

  // A container query, not a breakpoint: what matters is the width of this card, which is
  // narrow in a two-column phone grid. There the label is dropped and the stepper is centred.
  return (
    <div className="@container">
      <div className="flex h-9 items-center justify-center gap-2 rounded-lg bg-accent/10 coarse:h-auto @[12.5rem]:justify-between @[12.5rem]:pl-3">
        <span className="hidden items-center gap-1.5 text-sm font-medium text-accent @[12.5rem]:flex">
          <Check className="size-4" aria-hidden />
          In cart
        </span>
        <QuantityStepper
          tone="filled"
          itemName={product.name}
          quantity={quantity}
          availableStock={product.stock}
          isBusy={setQuantity.isPending || removeItem.isPending}
          onChange={(next) => setQuantity.mutate({ productId: product.id, quantity: next })}
          onRemove={() => removeItem.mutate(product.id)}
        />
      </div>
    </div>
  );
}
