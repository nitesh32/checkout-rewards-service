import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { inject } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { RewardsConfig } from '../../src/config.js';
import { createAppContext, type AppContext } from '../../src/context.js';
import type { PaymentProvider } from '../../src/modules/checkout/payment.js';

export interface TestApp {
  app: FastifyInstance;
  context: AppContext;
  close(): Promise<void>;
}

export interface TestAppOptions {
  rewards?: RewardsConfig;
  paymentProvider?: PaymentProvider;
}

/** A fully isolated service instance (own database) on the shared in-memory replica set. */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const context = await createAppContext({
    mongoUri: inject('mongoUri'),
    dbName: `test_${randomUUID().replaceAll('-', '')}`,
    rewards: options.rewards ?? { everyNOrders: 2, discountPercent: 10 },
    ...(options.paymentProvider ? { paymentProvider: options.paymentProvider } : {}),
  });
  const app = await buildApp(context);
  await app.ready();
  return {
    app,
    context,
    close: async () => {
      await app.close();
      await context.client.db(context.collections.products.dbName).dropDatabase();
      await context.client.close();
    },
  };
}

export async function insertProduct(
  { context }: TestApp,
  { sku, unitPriceMinor, stock }: { sku: string; unitPriceMinor: number; stock: number },
): Promise<string> {
  const now = new Date();
  const { insertedId } = await context.collections.products.insertOne({
    _id: new ObjectId(),
    sku,
    name: `Product ${sku}`,
    unitPriceMinor,
    stock,
    createdAt: now,
    updatedAt: now,
  });
  return insertedId.toHexString();
}

export async function stockOf({ context }: TestApp, productId: string): Promise<number> {
  const product = await context.collections.products.findOne({ _id: new ObjectId(productId) });
  return product?.stock ?? Number.NaN;
}

export interface CartLineInput {
  productId: string;
  quantity: number;
}

export async function createCartWith(testApp: TestApp, lines: CartLineInput[]): Promise<string> {
  const created = await testApp.app.inject({ method: 'POST', url: '/carts' });
  const cartId = created.json<{ id: string }>().id;
  for (const line of lines) {
    const response = await testApp.app.inject({
      method: 'POST',
      url: `/carts/${cartId}/items`,
      payload: line,
    });
    if (response.statusCode !== 200) {
      throw new Error(`Could not add item to cart: ${response.body}`);
    }
  }
  return cartId;
}

export function checkout(
  { app }: TestApp,
  cartId: string,
  { key = randomUUID(), body = {} }: { key?: string; body?: object } = {},
) {
  return app.inject({
    method: 'POST',
    url: `/carts/${cartId}/checkout`,
    headers: { 'idempotency-key': key },
    payload: body,
  });
}

/** Places `count` single-unit orders, each in its own cart, to advance the order counter. */
export async function placeOrders(
  testApp: TestApp,
  productId: string,
  count: number,
): Promise<void> {
  for (let placed = 0; placed < count; placed += 1) {
    const cartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);
    const response = await checkout(testApp, cartId);
    if (response.statusCode !== 201) throw new Error(`Setup checkout failed: ${response.body}`);
  }
}

/** Places single-unit orders until one reaches a milestone, and returns the reward it unlocked. */
export async function earnReward(testApp: TestApp, productId: string): Promise<string> {
  for (;;) {
    const cartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);
    const response = await checkout(testApp, cartId);
    if (response.statusCode !== 201) throw new Error(`Setup checkout failed: ${response.body}`);
    const { unlockedReward } = response.json<{ unlockedReward: { code: string } | null }>();
    if (unlockedReward) return unlockedReward.code;
  }
}

export async function generateCoupon({ app }: TestApp) {
  return app.inject({ method: 'POST', url: '/admin/coupons' });
}

export function errorCodeOf(response: { json(): unknown }): string {
  return (response.json() as { error: { code: string } }).error.code;
}

export function statusCounts(responses: { statusCode: number }[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const { statusCode } of responses) counts[statusCode] = (counts[statusCode] ?? 0) + 1;
  return counts;
}
