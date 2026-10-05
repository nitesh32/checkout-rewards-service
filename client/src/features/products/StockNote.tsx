import { FlashOnChange } from '@/components/FlashOnChange';

const LOW_STOCK_THRESHOLD = 10;

/** Says nothing for well-stocked products, so cards stay quiet; warns only when it matters. */
export function StockNote({ stock }: { stock: number }) {
  if (stock === 0 || stock > LOW_STOCK_THRESHOLD) return null;
  return (
    <p className="text-xs font-medium text-warning">
      <FlashOnChange value={stock}>Only {stock} left</FlashOnChange>
    </p>
  );
}
