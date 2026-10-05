import type { Product } from '@/lib/apiTypes';
import { getProductMedia, type Category } from '@/lib/productMedia';

export const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name' },
] as const;
export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export interface ShopFilters {
  searchText: string;
  isInStockOnly: boolean;
  category: Category | null;
  sort: SortValue;
}

const SORTERS: Record<SortValue, (a: Product, b: Product) => number> = {
  featured: () => 0,
  'price-asc': (a, b) => a.unitPriceMinor - b.unitPriceMinor,
  'price-desc': (a, b) => b.unitPriceMinor - a.unitPriceMinor,
  name: (a, b) => a.name.localeCompare(b.name),
};

/** Lower-cases and strips accents, so "Café" and "cafe" match each other. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Every typed word must appear somewhere in the product's name, category or SKU. */
function matchesSearch(product: Product, words: readonly string[]): boolean {
  const searchable = normalize(
    `${product.name} ${getProductMedia(product.sku).category} ${product.sku}`,
  );
  return words.every((word) => searchable.includes(word));
}

/**
 * Filters and sorts the catalogue in the browser. The shop already holds the whole catalogue, so
 * this is instant and needs no request per keystroke.
 */
export function filterAndSortProducts(
  products: readonly Product[],
  { searchText, isInStockOnly, category, sort }: ShopFilters,
): Product[] {
  const words = normalize(searchText).split(/\s+/).filter(Boolean);
  return products
    .filter((product) => matchesSearch(product, words))
    .filter((product) => !isInStockOnly || product.stock > 0)
    .filter((product) => category === null || getProductMedia(product.sku).category === category)
    .sort(SORTERS[sort]);
}
