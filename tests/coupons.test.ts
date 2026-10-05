import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  checkout,
  createCartWith,
  createTestApp,
  errorCodeOf,
  generateCoupon,
  insertProduct,
  placeOrders,
  statusCounts,
  stockOf,
  type TestApp,
} from './helpers/testApp.js';

interface CouponBody {
  code: string;
  milestone: number;
  percentOff: number;
  status: string;
}

describe('coupon milestones (n = 2, x = 10)', () => {
  let testApp: TestApp;
  let productId: string;
  beforeAll(async () => {
    testApp = await createTestApp({ rewards: { everyNOrders: 2, discountPercent: 10 } });
    productId = await insertProduct(testApp, {
      sku: 'MILESTONE',
      unitPriceMinor: 10_000,
      stock: 1_000,
    });
  });
  afterAll(() => testApp.close());

  it('refuses to generate before the first milestone is reached', async () => {
    await placeOrders(testApp, productId, 1);

    const response = await generateCoupon(testApp);

    expect(response.statusCode).toBe(409);
    expect(errorCodeOf(response)).toBe('NO_ELIGIBLE_MILESTONE');
    expect(response.json<{ error: { details: unknown } }>().error.details).toEqual({
      placedOrders: 1,
      nextMilestoneAt: 2,
    });
  });

  it('generates one coupon at the milestone and not a second for the same milestone', async () => {
    await placeOrders(testApp, productId, 1); // 2 orders placed in total

    const first = await generateCoupon(testApp);
    const second = await generateCoupon(testApp);

    expect(first.statusCode).toBe(201);
    expect(first.json<CouponBody>()).toMatchObject({
      milestone: 1,
      percentOff: 10,
      status: 'AVAILABLE',
    });
    expect(second.statusCode).toBe(409);
  });

  it('does not lose milestones that were passed: they are generated one per call', async () => {
    await placeOrders(testApp, productId, 4); // 6 orders: milestones 2 and 3 are now reached

    const responses = [
      await generateCoupon(testApp),
      await generateCoupon(testApp),
      await generateCoupon(testApp),
    ];

    expect(responses.map((r) => r.statusCode)).toEqual([201, 201, 409]);
    expect(responses.slice(0, 2).map((r) => r.json<CouponBody>().milestone)).toEqual([2, 3]);
  });

  it('creates exactly one coupon per milestone under concurrent generation', async () => {
    await placeOrders(testApp, productId, 4); // 10 orders: milestones 4 and 5 are now reached

    const responses = await Promise.all(Array.from({ length: 6 }, () => generateCoupon(testApp)));

    expect(statusCounts(responses)).toEqual({ 201: 2, 409: 4 });
    const milestones = responses
      .filter((r) => r.statusCode === 201)
      .map((r) => r.json<CouponBody>().milestone);
    expect(milestones.sort()).toEqual([4, 5]);
    expect(await testApp.context.collections.coupons.countDocuments()).toBe(5);
  });
});

describe('coupon redemption at checkout', () => {
  let testApp: TestApp;
  let productId: string;
  beforeAll(async () => {
    testApp = await createTestApp({ rewards: { everyNOrders: 1, discountPercent: 10 } });
    productId = await insertProduct(testApp, { sku: 'REDEEM', unitPriceMinor: 9_995, stock: 100 });
  });
  afterAll(() => testApp.close());

  async function newCoupon(): Promise<string> {
    await placeOrders(testApp, productId, 1);
    return (await generateCoupon(testApp)).json<CouponBody>().code;
  }

  it('applies a floored discount, snapshots it on the order and marks the coupon redeemed', async () => {
    const code = await newCoupon();
    const cartId = await createCartWith(testApp, [{ productId, quantity: 3 }]); // 29,985 paise

    const response = await checkout(testApp, cartId, { body: { couponCode: code.toLowerCase() } });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      subtotalMinor: 29_985,
      discountMinor: 2_998, // 2,998.5 floored
      totalMinor: 26_987,
      coupon: { code, percentOff: 10 },
    });
    const coupon = await testApp.context.collections.coupons.findOne({ code });
    expect(coupon?.status).toBe('REDEEMED');
    expect(coupon?.redeemedByOrderId?.toHexString()).toBe(response.json<{ id: string }>().id);
  });

  it('keeps the coupon available when the checkout fails', async () => {
    const code = await newCoupon();
    const cartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);
    await testApp.context.collections.products.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { stock: 0 } },
    );

    const failed = await checkout(testApp, cartId, { body: { couponCode: code } });
    await testApp.context.collections.products.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { stock: 100 } },
    );
    const retried = await checkout(testApp, cartId, { body: { couponCode: code } });

    expect(errorCodeOf(failed)).toBe('INSUFFICIENT_STOCK');
    expect(retried.statusCode).toBe(201);
    expect(retried.json<{ coupon: { code: string } }>().coupon.code).toBe(code);
  });

  it('distinguishes an unknown coupon from an already redeemed one', async () => {
    const code = await newCoupon();
    await checkout(testApp, await createCartWith(testApp, [{ productId, quantity: 1 }]), {
      body: { couponCode: code },
    });
    const cartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);

    const redeemed = await checkout(testApp, cartId, { body: { couponCode: code } });
    const unknown = await checkout(testApp, cartId, { body: { couponCode: 'SAVE-NOPE0000' } });

    expect(redeemed.statusCode).toBe(409);
    expect(errorCodeOf(redeemed)).toBe('COUPON_ALREADY_REDEEMED');
    expect(unknown.statusCode).toBe(404);
    expect(errorCodeOf(unknown)).toBe('COUPON_NOT_FOUND');
    expect(await stockOf(testApp, productId)).toBeGreaterThan(0);
  });

  it('counts discounted orders towards milestones', async () => {
    const before = await testApp.context.collections.counters.findOne({ _id: 'orders' });
    const code = await newCoupon();
    await checkout(testApp, await createCartWith(testApp, [{ productId, quantity: 1 }]), {
      body: { couponCode: code },
    });

    const after = await testApp.context.collections.counters.findOne({ _id: 'orders' });

    expect((after?.seq ?? 0) - (before?.seq ?? 0)).toBe(2); // the setup order and the discounted one
  });
});

describe('100% coupon', () => {
  it('brings the total to exactly zero, never below', async () => {
    const testApp = await createTestApp({ rewards: { everyNOrders: 1, discountPercent: 100 } });
    try {
      const productId = await insertProduct(testApp, {
        sku: 'FREE',
        unitPriceMinor: 1_999,
        stock: 10,
      });
      await placeOrders(testApp, productId, 1);
      const code = (await generateCoupon(testApp)).json<CouponBody>().code;

      const response = await checkout(
        testApp,
        await createCartWith(testApp, [{ productId, quantity: 2 }]),
        {
          body: { couponCode: code },
        },
      );

      expect(response.json()).toMatchObject({
        subtotalMinor: 3_998,
        discountMinor: 3_998,
        totalMinor: 0,
      });
    } finally {
      await testApp.close();
    }
  });
});
