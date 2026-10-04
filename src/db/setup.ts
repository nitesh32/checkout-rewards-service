import type { Db } from 'mongodb';
import type { Collections } from './collections.js';

const NAMESPACE_EXISTS_ERROR_CODE = 48;

async function ensureCollections(db: Db, names: string[]): Promise<void> {
  for (const name of names) {
    await db.createCollection(name).catch((error: unknown) => {
      if ((error as { code?: number }).code !== NAMESPACE_EXISTS_ERROR_CODE) throw error;
    });
  }
}

/**
 * Unique indexes are the last line of defence for the invariants the services also check:
 * one order per idempotency key, one order per cart, one coupon per milestone, unique codes.
 */
async function ensureIndexes({ products, orders, coupons }: Collections): Promise<void> {
  await products.createIndex({ sku: 1 }, { unique: true });
  await orders.createIndex({ idempotencyKey: 1 }, { unique: true });
  await orders.createIndex({ cartId: 1 }, { unique: true });
  await orders.createIndex({ orderNumber: 1 }, { unique: true });
  await orders.createIndex({ placedAt: -1 });
  await coupons.createIndex({ code: 1 }, { unique: true });
  await coupons.createIndex({ milestone: 1 }, { unique: true });
  await coupons.createIndex({ status: 1 });
}

/**
 * Collections and the order counter are created up front: concurrent transactions must not race
 * to create a collection or upsert the same counter document.
 */
export async function setupDatabase(db: Db, collections: Collections): Promise<void> {
  await ensureCollections(db, ['products', 'carts', 'orders', 'coupons', 'counters']);
  await ensureIndexes(collections);
  await collections.counters.updateOne(
    { _id: 'orders' },
    { $setOnInsert: { seq: 0 } },
    { upsert: true },
  );
}
