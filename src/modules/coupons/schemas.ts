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

/** What shoppers see of a reward: no milestones or redemption details. */
export const RewardSchema = Type.Object({
  code: Type.String(),
  percentOff: Type.Integer({ minimum: 1, maximum: 100 }),
});
export type RewardDto = Static<typeof RewardSchema>;

export const RewardProgressSchema = Type.Object({
  everyNOrders: Type.Integer({ minimum: 1, description: 'n: one reward per n orders' }),
  percentOff: Type.Integer({ minimum: 1, maximum: 100, description: 'x: discount of each reward' }),
  placedOrders: Type.Integer({ minimum: 0 }),
  rewardedMilestones: Type.Integer({ minimum: 0, description: 'Milestones that have a coupon' }),
  ordersTowardNext: Type.Integer({
    minimum: 0,
    description: 'Orders counted towards the next reward (0..n); restarts after generation',
  }),
  ordersLeft: Type.Integer({
    minimum: 0,
    description: 'Orders still needed; 0 when a reward is due',
  }),
  isRewardDue: Type.Boolean({
    description: 'A milestone is reached and its reward can be generated',
  }),
});
export type RewardProgressDto = Static<typeof RewardProgressSchema>;
