import type { ObjectId } from 'mongodb';
import type { AppContext } from '../../context.js';
import { withTransaction } from '../../db/client.js';
import { CURRENCY } from '../../shared/money.js';
import type { SalesReportDto } from './schemas.js';

/**
 * Read-only. Everything is read in one snapshot transaction so the order totals, quantities
 * and coupon counts all describe the same moment, even while checkouts are running.
 */
export function buildSalesReport({ client, collections }: AppContext): Promise<SalesReportDto> {
  return withTransaction(client, async (session) => {
    const [totals] = await collections.orders
      .aggregate<{ totalOrders: number; grossRevenueMinor: number; totalDiscountMinor: number }>(
        [
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              grossRevenueMinor: { $sum: '$subtotalMinor' },
              totalDiscountMinor: { $sum: '$discountMinor' },
            },
          },
        ],
        { session },
      )
      .toArray();

    const itemsSold = await collections.orders
      .aggregate<{ _id: ObjectId; sku: string; name: string; quantity: number }>(
        [
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.productId',
              sku: { $first: '$items.sku' },
              name: { $first: '$items.name' },
              quantity: { $sum: '$items.quantity' },
            },
          },
          { $sort: { sku: 1 } },
        ],
        { session },
      )
      .toArray();

    const couponCounts = await collections.coupons
      .aggregate<{ _id: 'AVAILABLE' | 'REDEEMED'; count: number }>(
        [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        { session },
      )
      .toArray();
    const countOf = (status: 'AVAILABLE' | 'REDEEMED') =>
      couponCounts.find((entry) => entry._id === status)?.count ?? 0;

    const grossRevenueMinor = totals?.grossRevenueMinor ?? 0;
    const totalDiscountMinor = totals?.totalDiscountMinor ?? 0;
    return {
      currency: CURRENCY,
      totalOrders: totals?.totalOrders ?? 0,
      itemsSold: itemsSold.map(({ _id, sku, name, quantity }) => ({
        productId: _id.toHexString(),
        sku,
        name,
        quantity,
      })),
      grossRevenueMinor,
      totalDiscountMinor,
      netRevenueMinor: grossRevenueMinor - totalDiscountMinor,
      coupons: {
        generated: countOf('AVAILABLE') + countOf('REDEEMED'),
        available: countOf('AVAILABLE'),
        redeemed: countOf('REDEEMED'),
      },
      generatedAt: new Date().toISOString(),
    };
  });
}
