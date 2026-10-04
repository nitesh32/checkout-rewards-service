import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  checkout,
  createCartWith,
  createTestApp,
  errorCodeOf,
  insertProduct,
  statusCounts,
  stockOf,
  type TestApp,
} from './helpers/testApp.js';

describe('checkout idempotency', () => {
  let testApp: TestApp;
  beforeAll(async () => {
    testApp = await createTestApp();
  });
  afterAll(() => testApp.close());

  it('creates exactly one order when the same request is retried in parallel', async () => {
    const productId = await insertProduct(testApp, {
      sku: 'PARALLEL',
      unitPriceMinor: 2_500,
      stock: 20,
    });
    const cartId = await createCartWith(testApp, [{ productId, quantity: 3 }]);
    const key = randomUUID();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => checkout(testApp, cartId, { key })),
    );

    expect(statusCounts(responses)).toEqual({ 201: 1, 200: 9 });
    const orderIds = new Set(responses.map((r) => r.json<{ id: string }>().id));
    expect(orderIds.size).toBe(1);
    expect(
      responses
        .filter((r) => r.statusCode === 200)
        .every((r) => r.headers['idempotent-replayed'] === 'true'),
    ).toBe(true);
    expect(await stockOf(testApp, productId)).toBe(17); // inventory charged once
    expect(
      await testApp.context.collections.orders.countDocuments({ cartId: new ObjectId(cartId) }),
    ).toBe(1);
  });

  it('replays the original order on a sequential retry', async () => {
    const productId = await insertProduct(testApp, {
      sku: 'SEQUENTIAL',
      unitPriceMinor: 100,
      stock: 5,
    });
    const cartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);
    const key = randomUUID();

    const first = await checkout(testApp, cartId, { key });
    const retry = await checkout(testApp, cartId, { key });

    expect(first.statusCode).toBe(201);
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first.json());
    expect(await stockOf(testApp, productId)).toBe(4);
  });

  it('rejects reuse of a key for a different request', async () => {
    const productId = await insertProduct(testApp, { sku: 'REUSE', unitPriceMinor: 100, stock: 5 });
    const cartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);
    const otherCartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);
    const key = randomUUID();
    await checkout(testApp, cartId, { key });

    const differentBody = await checkout(testApp, cartId, {
      key,
      body: { expectedTotalMinor: 100 },
    });
    const differentCart = await checkout(testApp, otherCartId, { key });

    expect(differentBody.statusCode).toBe(422);
    expect(errorCodeOf(differentBody)).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(errorCodeOf(differentCart)).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('reports the existing order when a different key checks out an already placed cart', async () => {
    const productId = await insertProduct(testApp, {
      sku: 'ALREADY',
      unitPriceMinor: 100,
      stock: 5,
    });
    const cartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);
    const first = await checkout(testApp, cartId);

    const second = await checkout(testApp, cartId);

    expect(second.statusCode).toBe(409);
    expect(errorCodeOf(second)).toBe('CART_ALREADY_CHECKED_OUT');
    expect(second.json<{ error: { details: { orderId: string } } }>().error.details.orderId).toBe(
      first.json<{ id: string }>().id,
    );
  });

  it('does not cache failures: the same key succeeds once stock is back', async () => {
    const productId = await insertProduct(testApp, {
      sku: 'RESTOCK',
      unitPriceMinor: 100,
      stock: 0,
    });
    const cartId = await createCartWith(testApp, []);
    // Add the line while stock exists, then sell out before checkout.
    await testApp.context.collections.products.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { stock: 1 } },
    );
    await testApp.app.inject({
      method: 'POST',
      url: `/carts/${cartId}/items`,
      payload: { productId, quantity: 1 },
    });
    await testApp.context.collections.products.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { stock: 0 } },
    );
    const key = randomUUID();

    const failed = await checkout(testApp, cartId, { key });
    await testApp.context.collections.products.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { stock: 1 } },
    );
    const retried = await checkout(testApp, cartId, { key });

    expect(errorCodeOf(failed)).toBe('INSUFFICIENT_STOCK');
    expect(retried.statusCode).toBe(201);
  });

  it('requires an Idempotency-Key header', async () => {
    const cartId = await createCartWith(testApp, []);
    const response = await testApp.app.inject({
      method: 'POST',
      url: `/carts/${cartId}/checkout`,
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(errorCodeOf(response)).toBe('VALIDATION_ERROR');
  });
});
