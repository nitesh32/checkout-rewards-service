import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PaymentProvider } from '../src/modules/checkout/payment.js';
import {
  checkout,
  createCartWith,
  createTestApp,
  earnReward,
  errorCodeOf,
  insertProduct,
  statusCounts,
  stockOf,
  type TestApp,
} from './helpers/testApp.js';

describe('concurrent checkouts', () => {
  let testApp: TestApp;
  beforeAll(async () => {
    testApp = await createTestApp({ rewards: { everyNOrders: 2, discountPercent: 10 } });
  });
  afterAll(() => testApp.close());

  it('never oversells: with 3 units and 10 competing carts exactly 3 succeed', async () => {
    const productId = await insertProduct(testApp, {
      sku: 'LAST-THREE',
      unitPriceMinor: 5_000,
      stock: 3,
    });
    const carts = await Promise.all(
      Array.from({ length: 10 }, () => createCartWith(testApp, [{ productId, quantity: 1 }])),
    );

    // Stock is only checked loosely when adding to a cart, so all 10 carts were accepted.
    const responses = await Promise.all(carts.map((cartId) => checkout(testApp, cartId)));

    expect(statusCounts(responses)).toEqual({ 201: 3, 409: 7 });
    expect(
      responses
        .filter((r) => r.statusCode === 409)
        .every((r) => errorCodeOf(r) === 'INSUFFICIENT_STOCK'),
    ).toBe(true);
    expect(await stockOf(testApp, productId)).toBe(0);
    expect(
      await testApp.context.collections.orders.countDocuments({
        'items.productId': new ObjectId(productId),
      }),
    ).toBe(3);
  });

  it('lets only one of several checkouts of the same cart win', async () => {
    const productId = await insertProduct(testApp, {
      sku: 'SAME-CART',
      unitPriceMinor: 1_000,
      stock: 50,
    });
    const cartId = await createCartWith(testApp, [{ productId, quantity: 2 }]);

    const responses = await Promise.all(Array.from({ length: 5 }, () => checkout(testApp, cartId)));

    expect(statusCounts(responses)).toEqual({ 201: 1, 409: 4 });
    expect(
      responses
        .filter((r) => r.statusCode === 409)
        .every((r) => errorCodeOf(r) === 'CART_ALREADY_CHECKED_OUT'),
    ).toBe(true);
    expect(await stockOf(testApp, productId)).toBe(48); // charged once, not five times
  });

  it('never loses a cart edit that races with checkout: it is in the order or rejected', async () => {
    const productId = await insertProduct(testApp, {
      sku: 'EDIT-RACE',
      unitPriceMinor: 100,
      stock: 500,
    });
    const extraId = await insertProduct(testApp, {
      sku: 'EDIT-RACE-EXTRA',
      unitPriceMinor: 100,
      stock: 500,
    });
    const carts = await Promise.all(
      Array.from({ length: 10 }, () => createCartWith(testApp, [{ productId, quantity: 1 }])),
    );

    const outcomes = await Promise.all(
      carts.map(async (cartId) => {
        const [edit, order] = await Promise.all([
          testApp.app.inject({
            method: 'POST',
            url: `/carts/${cartId}/items`,
            payload: { productId: extraId, quantity: 1 },
          }),
          checkout(testApp, cartId),
        ]);
        return { edit, order };
      }),
    );

    for (const { edit, order } of outcomes) {
      expect(order.statusCode).toBe(201);
      const skus = order.json<{ items: { sku: string }[] }>().items.map((item) => item.sku);
      if (edit.statusCode === 200) expect(skus).toContain('EDIT-RACE-EXTRA');
      else {
        expect(errorCodeOf(edit)).toBe('CART_NOT_OPEN');
        expect(skus).not.toContain('EDIT-RACE-EXTRA');
      }
    }
  });

  it('redeems a coupon at most once across concurrent checkouts', async () => {
    const productId = await insertProduct(testApp, {
      sku: 'COUPON-RACE',
      unitPriceMinor: 10_000,
      stock: 50,
    });
    const coupon = { code: await earnReward(testApp, productId) };
    const stockBefore = await stockOf(testApp, productId);
    const carts = await Promise.all(
      Array.from({ length: 5 }, () => createCartWith(testApp, [{ productId, quantity: 1 }])),
    );

    const responses = await Promise.all(
      carts.map((cartId) => checkout(testApp, cartId, { body: { couponCode: coupon.code } })),
    );

    expect(statusCounts(responses)).toEqual({ 201: 1, 409: 4 });
    expect(
      responses
        .filter((r) => r.statusCode === 409)
        .every((r) => errorCodeOf(r) === 'COUPON_ALREADY_REDEEMED'),
    ).toBe(true);
    // The four losers rolled back completely: only the winner consumed stock.
    expect(await stockOf(testApp, productId)).toBe(stockBefore - 1);
  });

  it('changes nothing when a multi-item checkout fails part-way', async () => {
    const plentiful = await insertProduct(testApp, {
      sku: 'PLENTY',
      unitPriceMinor: 100,
      stock: 10,
    });
    const scarce = await insertProduct(testApp, { sku: 'SCARCE', unitPriceMinor: 100, stock: 2 });
    const cartId = await createCartWith(testApp, [
      { productId: plentiful, quantity: 5 },
      { productId: scarce, quantity: 2 },
    ]);
    // Another customer takes a unit after this cart was filled.
    await testApp.context.collections.products.updateOne(
      { _id: new ObjectId(scarce) },
      { $inc: { stock: -1 } },
    );

    const response = await checkout(testApp, cartId);

    expect(response.statusCode).toBe(409);
    expect(errorCodeOf(response)).toBe('INSUFFICIENT_STOCK');
    expect(response.json<{ error: { details: unknown[] } }>().error.details).toEqual([
      { productId: scarce, sku: 'SCARCE', requested: 2, available: 1 },
    ]);
    expect(await stockOf(testApp, plentiful)).toBe(10);
    expect(await stockOf(testApp, scarce)).toBe(1);
    const cart = await testApp.context.collections.carts.findOne({ _id: new ObjectId(cartId) });
    expect(cart?.status).toBe('OPEN');
  });

  it('rolls back stock, coupon and cart when the payment is declined', async () => {
    const declining: PaymentProvider = {
      charge: () => Promise.resolve({ provider: 'test', status: 'DECLINED' }),
    };
    const declined = await createTestApp({ paymentProvider: declining });
    try {
      const productId = await insertProduct(declined, {
        sku: 'DECLINED',
        unitPriceMinor: 100,
        stock: 5,
      });
      const cartId = await createCartWith(declined, [{ productId, quantity: 2 }]);

      const response = await checkout(declined, cartId);

      expect(response.statusCode).toBe(402);
      expect(await stockOf(declined, productId)).toBe(5);
      expect(await declined.context.collections.orders.countDocuments()).toBe(0);
      const cart = await declined.context.collections.carts.findOne({ _id: new ObjectId(cartId) });
      expect(cart?.status).toBe('OPEN');
    } finally {
      await declined.close();
    }
  });
});
