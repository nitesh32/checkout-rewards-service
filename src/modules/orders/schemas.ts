import { Type, type Static } from '@sinclair/typebox';
import { DateTimeString, MinorAmount, ObjectIdString, PageQuery } from '../../shared/schemas.js';

export const OrderLineSchema = Type.Object({
  productId: ObjectIdString,
  sku: Type.String(),
  name: Type.String(),
  unitPriceMinor: MinorAmount,
  quantity: Type.Integer({ minimum: 1 }),
  lineTotalMinor: MinorAmount,
});

const CouponRef = Type.Object({ code: Type.String(), percentOff: Type.Integer() });

export const OrderSchema = Type.Object({
  id: ObjectIdString,
  orderNumber: Type.Integer({ minimum: 1 }),
  cartId: ObjectIdString,
  status: Type.Literal('PLACED'),
  items: Type.Array(OrderLineSchema),
  subtotalMinor: MinorAmount,
  discountMinor: MinorAmount,
  totalMinor: MinorAmount,
  currency: Type.String(),
  coupon: Type.Union([CouponRef, Type.Null()]),
  /** Set when this order reached a milestone and so created a new reward. */
  unlockedReward: Type.Union([CouponRef, Type.Null()]),
  payment: Type.Object({ provider: Type.String(), status: Type.Literal('SUCCEEDED') }),
  placedAt: DateTimeString,
});
export type OrderDto = Static<typeof OrderSchema>;

export const OrderIdParams = Type.Object({ orderId: ObjectIdString });

export const ListOrdersQuery = Type.Composite([
  PageQuery,
  Type.Object({
    from: Type.Optional(DateTimeString),
    to: Type.Optional(DateTimeString),
    couponCode: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  }),
]);
export type ListOrdersQuery = Static<typeof ListOrdersQuery>;
