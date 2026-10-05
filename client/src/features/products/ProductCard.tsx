import { FlashOnChange } from '@/components/FlashOnChange';
import { Money } from '@/components/Money';
import { ProductImage } from '@/components/ProductImage';
import type { Product } from '@/lib/apiTypes';
import { getProductMedia } from '@/lib/productMedia';
import { CardCartControl } from '../cart/CardCartControl';
import { StockNote } from './StockNote';

interface ProductCardProps {
  product: Product;
  /** True for cards in the first row, whose photos should load straight away. */
  isAboveTheFold?: boolean;
  onOpenQuickView: (product: Product) => void;
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/**
 * Laid out by what each part does: the photo and the name open the quick view and react to hover
 * together (the `open` group); the price and the cart control sit below, separate from them.
 */
export function ProductCard({
  product,
  isAboveTheFold = false,
  onOpenQuickView,
}: ProductCardProps) {
  const isSoldOut = product.stock === 0;
  const { category } = getProductMedia(product.sku);
  const openQuickView = () => onOpenQuickView(product);

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 transition-[border-color,box-shadow] duration-200 hover:border-accent/50 hover:shadow-md">
      <div className="group/open flex flex-col gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={openQuickView}
            aria-label={`Quick view ${product.name}`}
            className={`block w-full overflow-hidden rounded-xl ${FOCUS_RING}`}
          >
            <ProductImage sku={product.sku} isMuted={isSoldOut} isPriority={isAboveTheFold} />
          </button>
          {isSoldOut && (
            <span className="absolute left-2 top-2 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background">
              Sold out
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium leading-5">
            <button
              type="button"
              onClick={openQuickView}
              // Padding grows the tap target to 44px on touch; the negative margin keeps the layout unchanged.
              className={`line-clamp-2 block rounded-sm text-left underline-offset-2 group-hover/open:underline coarse:-my-3 coarse:py-3 ${FOCUS_RING}`}
            >
              {product.name}
            </button>
          </h2>
          <p className="text-xs text-muted-foreground">{category}</p>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-1">
        <p className="text-base font-bold">
          <FlashOnChange value={product.unitPriceMinor}>
            <Money amountMinor={product.unitPriceMinor} />
          </FlashOnChange>
        </p>
        <StockNote stock={product.stock} />
      </div>

      <CardCartControl product={product} />
    </li>
  );
}
