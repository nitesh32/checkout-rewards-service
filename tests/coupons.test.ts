import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  checkout,
  createCartWith,
  createTestApp,
  earnReward,
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

interface OrderBody {
  id: string;
  unlockedReward: { code: string; percentOff: number } | null;
}

describe('rewards unlocked by orders (n = 2, x = 10)', () => {
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

  const orderOne = async (key?: string) =>
    checkout(testApp, await createCartWith(testApp, [{ productId, quantity: 1 }]), { key });

  it('creates the coupon with the order that reaches the milestone, and not before', async () => {
    const first = await orderOne();
    expect(first.json<OrderBody>().unlockedReward).toBeNull();
    expect(await testApp.context.collections.coupons.countDocuments()).toBe(0);

    const second = await orderOne();

    const { unlockedReward, id } = second.json<OrderBody>();
    expect(unlockedReward).toMatchObject({ percentOff: 10 });
    const coupon = await testApp.context.collections.coupons.findOne({});
    expect(coupon).toMatchObject({ code: unlockedReward?.code, milestone: 1, status: 'AVAILABLE' });
    const stored = await testApp.app.inject({ method: 'GET', url: `/orders/${id}` });
    expect(stored.json<OrderBody>().unlockedReward).toEqual(unlockedReward);
  });

  it('a failed checkout at a milestone creates no coupon', async () => {
    await orderOne(); // 3 orders: the next one reaches milestone 2
    const cartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);
    await testApp.context.collections.products.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { stock: 0 } },
    );

    const failed = await checkout(testApp, cartId);
    await testApp.context.collections.products.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { stock: 1_000 } },
    );

    expect(errorCodeOf(failed)).toBe('INSUFFICIENT_STOCK');
    expect(await testApp.context.collections.coupons.countDocuments()).toBe(1);
    expect((await orderOne()).json<OrderBody>().unlockedReward).not.toBeNull();
    expect(await testApp.context.collections.coupons.countDocuments()).toBe(2);
  });

  it('a retried checkout replays the same reward instead of creating another', async () => {
    await orderOne(); // 5 orders: the next one reaches milestone 3
    const cartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);

    const first = await checkout(testApp, cartId, { key: 'milestone-retry-key' });
    const retry = await checkout(testApp, cartId, { key: 'milestone-retry-key' });

    expect(retry.statusCode).toBe(200);
    expect(retry.json<OrderBody>().unlockedReward).toEqual(first.json<OrderBody>().unlockedReward);
    expect(await testApp.context.collections.coupons.countDocuments()).toBe(3);
  });

  it('creates exactly one coupon per milestone under concurrent checkouts', async () => {
    const carts = await Promise.all(
      Array.from({ length: 8 }, () => createCartWith(testApp, [{ productId, quantity: 1 }])),
    );

    const responses = await Promise.all(carts.map((cartId) => checkout(testApp, cartId)));

    expect(statusCounts(responses)).toEqual({ 201: 8 });
    const unlocked = responses.filter((r) => r.json<OrderBody>().unlockedReward !== null);
    expect(unlocked).toHaveLength(4); // orders 7 to 14 reach milestones 4 to 7
    const milestones = await testApp.context.collections.coupons.distinct('milestone');
    expect(milestones.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('admin generation catches up milestones without a coupon (n = 2)', () => {
  let testApp: TestApp;
  let productId: string;
  beforeAll(async () => {
    testApp = await createTestApp({ rewards: { everyNOrders: 2, discountPercent: 10 } });
    productId = await insertProduct(testApp, { sku: 'CATCH-UP', unitPriceMinor: 100, stock: 100 });
  });
  afterAll(() => testApp.close());

  /** Like orders placed before rewards were automatic: milestones reached, coupons missing. */
  const forgetCouponsFrom = (milestone: number) =>
    testApp.context.collections.coupons.deleteMany({ milestone: { $gte: milestone } });

  it('has nothing to do while every reached milestone has its coupon', async () => {
    await placeOrders(testApp, productId, 3);

    const response = await generateCoupon(testApp);

    expect(response.statusCode).toBe(409);
    expect(errorCodeOf(response)).toBe('NO_ELIGIBLE_MILESTONE');
    expect(response.json<{ error: { details: unknown } }>().error.details).toEqual({
      placedOrders: 3,
      nextMilestoneAt: 4,
    });
  });

  it('generates missing milestones one per call', async () => {
    await placeOrders(testApp, productId, 3); // 6 orders: milestones 1 to 3 have coupons
    await forgetCouponsFrom(2);

    const responses = [
      await generateCoupon(testApp),
      await generateCoupon(testApp),
      await generateCoupon(testApp),
    ];

    expect(responses.map((r) => r.statusCode)).toEqual([201, 201, 409]);
    expect(responses.slice(0, 2).map((r) => r.json<CouponBody>().milestone)).toEqual([2, 3]);
  });

  it('creates exactly one coupon per missing milestone under concurrent generation', async () => {
    await forgetCouponsFrom(2);

    const responses = await Promise.all(Array.from({ length: 6 }, () => generateCoupon(testApp)));

    expect(statusCounts(responses)).toEqual({ 201: 2, 409: 4 });
    const milestones = responses
      .filter((r) => r.statusCode === 201)
      .map((r) => r.json<CouponBody>().milestone);
    expect(milestones.sort()).toEqual([2, 3]);
    expect(await testApp.context.collections.coupons.countDocuments()).toBe(3);
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

  const newCoupon = () => earnReward(testApp, productId);

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
      const code = await earnReward(testApp, productId);

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

describe('progress towards the next reward (GET /rewards/progress)', () => {
  interface Progress {
    everyNOrders: number;
    ordersTowardNext: number;
    ordersLeft: number;
    isRewardDue: boolean;
  }
  const progressOf = async (testApp: TestApp) =>
    (await testApp.app.inject({ method: 'GET', url: '/rewards/progress' })).json<Progress>();

  it('counts orders towards the reward and starts again when an order unlocks it', async () => {
    const testApp = await createTestApp({ rewards: { everyNOrders: 3, discountPercent: 10 } });
    try {
      const productId = await insertProduct(testApp, {
        sku: 'TRACK',
        unitPriceMinor: 100,
        stock: 50,
      });

      expect(await progressOf(testApp)).toMatchObject({
        everyNOrders: 3,
        ordersTowardNext: 0,
        ordersLeft: 3,
        isRewardDue: false,
      });

      await placeOrders(testApp, productId, 2);
      expect(await progressOf(testApp)).toMatchObject({ ordersTowardNext: 2, ordersLeft: 1 });

      await placeOrders(testApp, productId, 1); // the 3rd order creates the reward
      expect(await progressOf(testApp)).toMatchObject({
        ordersTowardNext: 0,
        ordersLeft: 3,
        isRewardDue: false,
      });

      await placeOrders(testApp, productId, 1);
      expect(await progressOf(testApp)).toMatchObject({ ordersTowardNext: 1, ordersLeft: 2 });
    } finally {
      await testApp.close();
    }
  });

  it('shows a reward as due only when a reached milestone has no coupon', async () => {
    const testApp = await createTestApp({ rewards: { everyNOrders: 1, discountPercent: 10 } });
    try {
      const productId = await insertProduct(testApp, {
        sku: 'MISSING',
        unitPriceMinor: 100,
        stock: 50,
      });
      await placeOrders(testApp, productId, 1);
      await testApp.context.collections.coupons.deleteMany({});

      expect(await progressOf(testApp)).toMatchObject({ isRewardDue: true });
      expect((await generateCoupon(testApp)).statusCode).toBe(201);
      expect(await progressOf(testApp)).toMatchObject({ isRewardDue: false, ordersLeft: 1 });
    } finally {
      await testApp.close();
    }
  });
});
