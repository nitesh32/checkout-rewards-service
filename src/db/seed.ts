import type { Collection } from 'mongodb';
import type { ProductDoc } from './collections.js';

type SeedProduct = Pick<ProductDoc, 'sku' | 'name' | 'unitPriceMinor' | 'stock'>;

export const SEED_PRODUCTS: readonly SeedProduct[] = [
  { sku: 'NOTEBOOK-A5', name: 'Dotted Notebook A5', unitPriceMinor: 24_900, stock: 200 },
  { sku: 'PEN-GEL-BLK', name: 'Gel Pen Black (Pack of 5)', unitPriceMinor: 14_950, stock: 500 },
  { sku: 'MUG-CERAMIC', name: 'Ceramic Mug 350ml', unitPriceMinor: 39_900, stock: 120 },
  { sku: 'BOTTLE-STEEL', name: 'Steel Water Bottle 750ml', unitPriceMinor: 79_900, stock: 80 },
  { sku: 'BAG-CANVAS', name: 'Canvas Tote Bag', unitPriceMinor: 49_900, stock: 60 },
  { sku: 'LAMP-DESK-LTD', name: 'Desk Lamp (Limited Edition)', unitPriceMinor: 349_900, stock: 3 },
];

/** Idempotent: existing products keep their current price and stock. */
export async function seedProducts(products: Collection<ProductDoc>): Promise<void> {
  const now = new Date();
  await products.bulkWrite(
    SEED_PRODUCTS.map((product) => ({
      updateOne: {
        filter: { sku: product.sku },
        update: { $setOnInsert: { ...product, createdAt: now, updatedAt: now } },
        upsert: true,
      },
    })),
  );
}
