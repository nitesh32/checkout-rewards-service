import { Money } from '@/components/Money';
import { ProductImage } from '@/components/ProductImage';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { Product } from '@/lib/apiTypes';
import { getProductMedia } from '@/lib/productMedia';
import { CardCartControl } from '../cart/CardCartControl';
import { StockNote } from './StockNote';

interface QuickViewDialogProps {
  product: Product | null;
  onClose: () => void;
}

export function QuickViewDialog({ product, onClose }: QuickViewDialogProps) {
  return (
    <Dialog open={product !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        {product && (
          <div className="grid gap-6 p-4 sm:grid-cols-2 sm:p-6">
            <ProductImage sku={product.sku} isMuted={product.stock === 0} className="rounded-lg" />
            <div className="flex flex-col justify-center gap-3">
              <DialogTitle className="text-2xl font-bold leading-8 tracking-tight">
                {product.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {getProductMedia(product.sku).category} · {product.sku}
              </DialogDescription>
              <p className="text-lg font-semibold">
                <Money amountMinor={product.unitPriceMinor} />
              </p>
              <StockNote stock={product.stock} />
              <div className="mt-2">
                <CardCartControl product={product} />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
