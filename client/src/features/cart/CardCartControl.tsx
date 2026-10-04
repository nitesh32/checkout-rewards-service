import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/apiTypes';
import { AddToCartButton } from './AddToCartButton';
import { useCart, useRemoveItem, useSetQuantity } from './cartApi';

const MAX_LINE_QUANTITY = 100;

/**
 * The last row of a product card: "Add to cart" until the product is in the cart, then a quantity
 * stepper in the very same slot, so the card never changes size.
 */
export function CardCartControl({ product }: { product: Product }) {
  const cart = useCart();
  const setQuantity = useSetQuantity();
  const removeItem = useRemoveItem();

  const quantity = cart.data?.lines.find((line) => line.productId === product.id)?.quantity ?? 0;
  if (product.stock === 0 || quantity === 0) {
    return <AddToCartButton product={product} className="w-full font-semibold" />;
  }

  const isBusy = setQuantity.isPending || removeItem.isPending;
  const maxQuantity = Math.min(MAX_LINE_QUANTITY, product.stock);
  const decrease = () =>
    quantity === 1
      ? removeItem.mutate(product.id)
      : setQuantity.mutate({ productId: product.id, quantity: quantity - 1 });

  return (
    <div
      role="group"
      aria-label={`Quantity of ${product.name}`}
      className="flex items-center justify-between rounded-lg bg-accent text-accent-foreground"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Decrease quantity of ${product.name}`}
        disabled={isBusy}
        onClick={decrease}
        className="hover:bg-accent-foreground/15"
      >
        <Minus />
      </Button>
      <span className="text-sm font-semibold tabular-nums">{quantity} in cart</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Increase quantity of ${product.name}`}
        title={quantity >= maxQuantity ? `Only ${product.stock} available` : undefined}
        disabled={isBusy || quantity >= maxQuantity}
        onClick={() => setQuantity.mutate({ productId: product.id, quantity: quantity + 1 })}
        className="hover:bg-accent-foreground/15"
      >
        <Plus />
      </Button>
    </div>
  );
}
