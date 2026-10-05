import { Check, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ProductImage } from '@/components/ProductImage';
import { Button, type ButtonStyleOptions } from '@/components/ui/button';
import type { Product } from '@/lib/apiTypes';
import { useAddToCart } from './cartApi';
import { useCartSheet } from './CartSheetContext';

const ADDED_LABEL_MS = 1200;

interface AddToCartButtonProps extends ButtonStyleOptions {
  product: Product;
  label?: string;
}

/** Adds one unit; a sold-out product gets a "Notify me" button instead. */
export function AddToCartButton({
  product,
  label = 'Add to cart',
  ...style
}: AddToCartButtonProps) {
  const addToCart = useAddToCart();
  const { setOpen } = useCartSheet();
  const [isShowingAdded, setIsShowingAdded] = useState(false);

  if (product.stock === 0) {
    return (
      <Button
        {...style}
        variant="outline"
        onClick={() =>
          toast.info(`${product.name} is sold out`, {
            description: 'Back-in-stock alerts are not available yet.',
          })
        }
      >
        Notify me
      </Button>
    );
  }

  const handleAdd = () => {
    addToCart.mutate(
      { productId: product.id, quantity: 1 },
      {
        onSuccess: () => {
          setIsShowingAdded(true);
          setTimeout(() => setIsShowingAdded(false), ADDED_LABEL_MS);
          toast(`${product.name} added to cart`, {
            icon: <ProductImage sku={product.sku} className="aspect-auto size-10 rounded-md" />,
            action: { label: 'View cart', onClick: () => setOpen(true) },
          });
        },
      },
    );
  };

  return (
    <Button
      {...style}
      aria-label={`Add to cart: ${product.name}`}
      disabled={addToCart.isPending}
      onClick={handleAdd}
    >
      {isShowingAdded ? <Check /> : <ShoppingBag />}
      {isShowingAdded ? 'Added' : label}
    </Button>
  );
}
