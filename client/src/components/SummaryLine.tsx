import { Money } from '@/components/Money';
import { ProductImage } from '@/components/ProductImage';

interface SummaryLineProps {
  sku: string;
  name: string;
  quantity: number;
  lineTotalMinor: number;
}

/** One purchased item with its thumbnail: used by the checkout summary and the order confirmation. */
export function SummaryLine({ sku, name, quantity, lineTotalMinor }: SummaryLineProps) {
  return (
    <li className="flex items-center gap-3 py-3">
      <ProductImage sku={sku} className="aspect-auto h-14 w-11 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">Qty {quantity}</p>
      </div>
      <Money amountMinor={lineTotalMinor} />
    </li>
  );
}
