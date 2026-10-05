import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { AppContext } from '../../context.js';
import { errorResponses, pageOf } from '../../shared/schemas.js';
import { Type } from '@sinclair/typebox';
import { CouponSchema, ListCouponsQuery, RewardSchema } from './schemas.js';
import { generateCoupon, listAvailableRewards, listCoupons } from './service.js';

export const couponRoutes =
  (context: AppContext): FastifyPluginCallbackTypebox =>
  (app, _options, done) => {
    app.post(
      '/admin/coupons',
      {
        schema: {
          tags: ['Admin'],
          summary: 'Generate the coupon for the earliest eligible, unrewarded milestone',
          response: { 201: CouponSchema, ...errorResponses(409) },
        },
      },
      async (_request, reply) => reply.code(201).send(await generateCoupon(context)),
    );

    app.get(
      '/rewards',
      {
        schema: {
          tags: ['Rewards'],
          summary: 'Rewards any shopper can use right now, best first',
          response: { 200: Type.Array(RewardSchema) },
        },
      },
      () => listAvailableRewards(context),
    );

    app.get(
      '/admin/coupons',
      {
        schema: {
          tags: ['Admin'],
          summary: 'List coupons, newest first (admin)',
          querystring: ListCouponsQuery,
          response: { 200: pageOf(CouponSchema), ...errorResponses(400) },
        },
      },
      (request) => listCoupons(context, request.query),
    );
    done();
  };
