import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  checkout,
  createCartWith,
  createTestApp,
  generateCoupon,
  insertProduct,
  type TestApp,
} from './helpers/testApp.js';

interface SalesReport {
  totalOrders: number;
  itemsSold: { sku: string; quantity: number }[];
  grossRevenueMinor: number;
  totalDiscountMinor: number;
  netRevenueMinor: number;
  coupons: { generated: number; available: number; redeemed: number };
  generatedAt: string;
}

interface OrderListItem {
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  items: { sku: string; quantity: number }[];
}

describe('sales report', () => {
  let testApp: TestApp;
  beforeAll(async () => {
    testApp = await createTestApp({ rewards: { everyNOrders: 2, discountPercent: 10 } });
  });
  afterAll(() => testApp.close());

  const fetchReport = async () =>
    (await testApp.app.inject({ method: 'GET', url: '/admin/reports/sales' })).json<SalesReport>();

  it('reports zeros, not errors, for an empty store', async () => {
    expect(await fetchReport()).toMatchObject({
      totalOrders: 0,
      itemsSold: [],
      grossRevenueMinor: 0,
      totalDiscountMinor: 0,
      netRevenueMinor: 0,
      coupons: { generated: 0, available: 0, redeemed: 0 },
    });
  });

  it('reconciles with the orders and coupons the API returns, and reading it mutates nothing', async () => {
    const pen = await insertProduct(testApp, { sku: 'PEN', unitPriceMinor: 1_550, stock: 100 });
    const book = await insertProduct(testApp, { sku: 'BOOK', unitPriceMinor: 24_999, stock: 100 });
    for (const lines of [
      [{ productId: pen, quantity: 3 }],
      [
        { productId: book, quantity: 1 },
        { productId: pen, quantity: 2 },
      ],
    ]) {
      await checkout(testApp, await createCartWith(testApp, lines));
    }
    const coupon = (await generateCoupon(testApp)).json<{ code: string }>();
    await checkout(testApp, await createCartWith(testApp, [{ productId: book, quantity: 2 }]), {
      body: { couponCode: coupon.code },
    });
    await generateCoupon(testApp); // 3 orders placed: milestone 2 not reached, so nothing is generated

    const report = await fetchReport();
    const orders = (
      await testApp.app.inject({ method: 'GET', url: '/admin/orders?limit=100' })
    ).json<{ data: OrderListItem[] }>().data;

    expect(report.totalOrders).toBe(orders.length);
    expect(report.grossRevenueMinor).toBe(orders.reduce((sum, o) => sum + o.subtotalMinor, 0));
    expect(report.totalDiscountMinor).toBe(orders.reduce((sum, o) => sum + o.discountMinor, 0));
    expect(report.netRevenueMinor).toBe(orders.reduce((sum, o) => sum + o.totalMinor, 0));
    expect(report.netRevenueMinor).toBe(report.grossRevenueMinor - report.totalDiscountMinor);
    expect(report.itemsSold.map(({ sku, quantity }) => ({ sku, quantity }))).toEqual([
      { sku: 'BOOK', quantity: 3 },
      { sku: 'PEN', quantity: 5 },
    ]);
    expect(report.coupons).toEqual({ generated: 1, available: 0, redeemed: 1 });

    const again = await fetchReport();
    expect({ ...again, generatedAt: '' }).toEqual({ ...report, generatedAt: '' });
  });
});
