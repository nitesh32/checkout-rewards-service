import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { AppContext } from '../../context.js';
import { errorResponses, pageOf } from '../../shared/schemas.js';
import { CouponSchema, ListCouponsQuery } from './schemas.js';
import { generateCoupon, listCoupons } from './service.js';

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
