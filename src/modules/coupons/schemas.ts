import { Type, type Static } from '@sinclair/typebox';
import { DateTimeString, ObjectIdString, PageQuery } from '../../shared/schemas.js';

export const CouponSchema = Type.Object({
  id: ObjectIdString,
  code: Type.String(),
  percentOff: Type.Integer({ minimum: 1, maximum: 100 }),
  milestone: Type.Integer({ minimum: 1 }),
  status: Type.Union([Type.Literal('AVAILABLE'), Type.Literal('REDEEMED')]),
  redeemedByOrderId: Type.Union([ObjectIdString, Type.Null()]),
  generatedAt: DateTimeString,
  redeemedAt: Type.Union([DateTimeString, Type.Null()]),
});
export type CouponDto = Static<typeof CouponSchema>;

export const ListCouponsQuery = Type.Composite([
  PageQuery,
  Type.Object({
    status: Type.Optional(Type.Union([Type.Literal('AVAILABLE'), Type.Literal('REDEEMED')])),
  }),
]);
export type ListCouponsQuery = Static<typeof ListCouponsQuery>;
