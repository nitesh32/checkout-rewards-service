import type { Collection } from 'mongodb';
import type { ProductDoc } from './collections.js';

type SeedProduct = Pick<ProductDoc, 'sku' | 'name' | 'unitPriceMinor' | 'stock'>;

export const SEED_PRODUCTS: readonly SeedProduct[] = [
  { sku: 'SPEAKER-BT-BLK', name: 'Portable Bluetooth Speaker', unitPriceMinor: 799_900, stock: 80 },
  { sku: 'EARBUDS-TWS-BLK', name: 'True Wireless Earbuds', unitPriceMinor: 1_299_900, stock: 120 },
  {
    sku: 'HEADPHONES-OVR-BLK',
    name: 'Wireless Over-Ear Headphones',
    unitPriceMinor: 2_499_000,
    stock: 60,
  },
  { sku: 'PHONE-PRO-BLU', name: 'Smartphone Pro 256GB', unitPriceMinor: 6_990_000, stock: 40 },
  { sku: 'WATCH-SMART-BLU', name: 'Smartwatch Sport', unitPriceMinor: 3_290_000, stock: 50 },
  {
    sku: 'CAMERA-MIRRORLESS',
    name: 'Mirrorless Camera Body (Limited Edition)',
    unitPriceMinor: 12_490_000,
    stock: 3,
  },
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
