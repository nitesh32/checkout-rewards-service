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
  stockOf,
  type TestApp,
} from './helpers/testApp.js';

interface Quote {
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  coupon: { code: string; percentOff: number } | null;
}

describe('checkout quote and public rewards', () => {
  let testApp: TestApp;
  let productId: string;
  beforeAll(async () => {
    testApp = await createTestApp({ rewards: { everyNOrders: 1, discountPercent: 10 } });
    productId = await insertProduct(testApp, { sku: 'QUOTE', unitPriceMinor: 9_995, stock: 100 });
  });
  afterAll(() => testApp.close());

  const quote = (cartId: string, couponCode?: string) =>
    testApp.app.inject({
      method: 'GET',
      url: `/carts/${cartId}/quote${couponCode ? `?couponCode=${couponCode}` : ''}`,
    });

  async function newRewardCode(): Promise<string> {
    await placeOrders(testApp, productId, 1);
    return (await generateCoupon(testApp)).json<{ code: string }>().code;
  }

  it('prices the cart without a code', async () => {
    const cartId = await createCartWith(testApp, [{ productId, quantity: 3 }]);

    const response = await quote(cartId);

    expect(response.statusCode).toBe(200);
    expect(response.json<Quote>()).toMatchObject({
      subtotalMinor: 29_985,
      discountMinor: 0,
      totalMinor: 29_985,
      coupon: null,
    });
  });

  it('quotes exactly what the order then charges, and quoting redeems nothing', async () => {
    const code = await newRewardCode();
    const cartId = await createCartWith(testApp, [{ productId, quantity: 3 }]);
    const stockBefore = await stockOf(testApp, productId);

    const quoted = (await quote(cartId, code.toLowerCase())).json<Quote>();
    const coupon = await testApp.context.collections.coupons.findOne({ code });
    expect(coupon?.status).toBe('AVAILABLE');
    expect(await stockOf(testApp, productId)).toBe(stockBefore);

    const order = await checkout(testApp, cartId, {
      body: { couponCode: code, expectedTotalMinor: quoted.totalMinor },
    });

    expect(quoted).toMatchObject({
      discountMinor: 2_998,
      totalMinor: 26_987,
      coupon: { code, percentOff: 10 },
    });
    expect(order.statusCode).toBe(201);
    expect(order.json()).toMatchObject({
      discountMinor: quoted.discountMinor,
      totalMinor: quoted.totalMinor,
    });
  });

  it('explains an unknown code and a used code differently', async () => {
    const usedCode = await newRewardCode();
    await checkout(testApp, await createCartWith(testApp, [{ productId, quantity: 1 }]), {
      body: { couponCode: usedCode },
    });
    const cartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);

    const unknown = await quote(cartId, 'SAVE-NOPE0000');
    const used = await quote(cartId, usedCode);

    expect([unknown.statusCode, errorCodeOf(unknown)]).toEqual([404, 'COUPON_NOT_FOUND']);
    expect([used.statusCode, errorCodeOf(used)]).toEqual([409, 'COUPON_ALREADY_REDEEMED']);
  });

  it('refuses to quote a cart that has been checked out', async () => {
    const cartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);
    await checkout(testApp, cartId);

    const response = await quote(cartId);

    expect([response.statusCode, errorCodeOf(response)]).toEqual([409, 'CART_NOT_OPEN']);
  });

  it('lists only available rewards, without internal fields', async () => {
    const available = await newRewardCode();
    const used = await newRewardCode();
    await testApp.context.collections.coupons.updateOne(
      { code: used },
      { $set: { status: 'REDEEMED', redeemedByOrderId: new ObjectId() } },
    );

    const rewards = (await testApp.app.inject({ method: 'GET', url: '/rewards' })).json<
      Record<string, unknown>[]
    >();

    expect(rewards).toContainEqual({ code: available, percentOff: 10 });
    expect(rewards.map((reward) => reward['code'])).not.toContain(used);
    expect(Object.keys(rewards[0] ?? {}).sort()).toEqual(['code', 'percentOff']);
  });
});
