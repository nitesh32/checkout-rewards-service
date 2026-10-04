import { filterAndSortProducts, type ShopFilters } from '@/features/products/filterProducts';
import type { Product } from '@/lib/apiTypes';

function product(overrides: Partial<Product> & Pick<Product, 'sku' | 'name'>): Product {
  return {
    id: overrides.sku,
    currency: 'INR',
    unitPriceMinor: 100_00,
    stock: 10,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const SPEAKER = product({
  sku: 'SPEAKER-BT-BLK',
  name: 'Portable Bluetooth Speaker',
  unitPriceMinor: 799_900,
});
const EARBUDS = product({
  sku: 'EARBUDS-TWS-BLK',
  name: 'True Wireless Earbuds',
  unitPriceMinor: 1_299_900,
});
const CAMERA = product({
  sku: 'CAMERA-MIRRORLESS',
  name: 'Mirrorless Camera Body',
  unitPriceMinor: 12_490_000,
  stock: 0,
});
const CATALOGUE = [SPEAKER, EARBUDS, CAMERA];

const NO_FILTERS: ShopFilters = {
  searchText: '',
  isInStockOnly: false,
  category: null,
  sort: 'featured',
};
const namesOf = (products: Product[]) => products.map((item) => item.name);

describe('filterAndSortProducts', () => {
  it('returns everything, in catalogue order, when no filter is set', () => {
    expect(filterAndSortProducts(CATALOGUE, NO_FILTERS)).toEqual(CATALOGUE);
  });

  it('matches case-insensitively and by any part of the name', () => {
    const result = filterAndSortProducts(CATALOGUE, { ...NO_FILTERS, searchText: 'BLUETOOTH' });
    expect(namesOf(result)).toEqual(['Portable Bluetooth Speaker']);
  });

  it('requires every typed word, in any order', () => {
    expect(
      namesOf(filterAndSortProducts(CATALOGUE, { ...NO_FILTERS, searchText: 'speaker port' })),
    ).toEqual(['Portable Bluetooth Speaker']);
    expect(
      filterAndSortProducts(CATALOGUE, { ...NO_FILTERS, searchText: 'speaker camera' }),
    ).toEqual([]);
  });

  it('also searches the category and the SKU', () => {
    expect(
      namesOf(filterAndSortProducts(CATALOGUE, { ...NO_FILTERS, searchText: 'audio' })),
    ).toEqual(['Portable Bluetooth Speaker', 'True Wireless Earbuds']);
    expect(
      namesOf(filterAndSortProducts(CATALOGUE, { ...NO_FILTERS, searchText: 'camera-mirror' })),
    ).toEqual(['Mirrorless Camera Body']);
  });

  it('ignores accents and extra whitespace', () => {
    const accented = product({ sku: 'X', name: 'Café Grinder' });
    expect(
      filterAndSortProducts([accented], { ...NO_FILTERS, searchText: '  cafe   grinder ' }),
    ).toEqual([accented]);
  });

  it('keeps only products in stock when asked', () => {
    const result = filterAndSortProducts(CATALOGUE, { ...NO_FILTERS, isInStockOnly: true });
    expect(namesOf(result)).not.toContain('Mirrorless Camera Body');
  });

  it('filters by category', () => {
    expect(
      namesOf(filterAndSortProducts(CATALOGUE, { ...NO_FILTERS, category: 'Cameras' })),
    ).toEqual(['Mirrorless Camera Body']);
  });

  it('sorts by price and by name without changing the input', () => {
    const input = [...CATALOGUE];
    expect(namesOf(filterAndSortProducts(input, { ...NO_FILTERS, sort: 'price-desc' }))[0]).toBe(
      'Mirrorless Camera Body',
    );
    expect(namesOf(filterAndSortProducts(input, { ...NO_FILTERS, sort: 'price-asc' }))[0]).toBe(
      'Portable Bluetooth Speaker',
    );
    expect(namesOf(filterAndSortProducts(input, { ...NO_FILTERS, sort: 'name' }))[0]).toBe(
      'Mirrorless Camera Body',
    );
    expect(input).toEqual(CATALOGUE);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterAndSortProducts(CATALOGUE, { ...NO_FILTERS, searchText: 'zzz' })).toEqual([]);
  });
});
