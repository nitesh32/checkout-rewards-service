import { Type, type Static } from '@sinclair/typebox';
import { DateTimeString, MinorAmount, ObjectIdString } from '../../shared/schemas.js';

export const SalesReportSchema = Type.Object({
  currency: Type.String(),
  totalOrders: Type.Integer({ minimum: 0 }),
  itemsSold: Type.Array(
    Type.Object({
      productId: ObjectIdString,
      sku: Type.String(),
      name: Type.String(),
      quantity: Type.Integer({ minimum: 1 }),
    }),
  ),
  grossRevenueMinor: MinorAmount,
  totalDiscountMinor: MinorAmount,
  netRevenueMinor: MinorAmount,
  coupons: Type.Object({
    generated: Type.Integer({ minimum: 0 }),
    available: Type.Integer({ minimum: 0 }),
    redeemed: Type.Integer({ minimum: 0 }),
  }),
  generatedAt: DateTimeString,
});
export type SalesReportDto = Static<typeof SalesReportSchema>;
