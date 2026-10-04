import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { AppContext } from '../../context.js';
import { errorResponses } from '../../shared/schemas.js';
import { OrderSchema } from '../orders/schemas.js';
import { toOrderDto } from '../orders/service.js';
import { CartIdParams, CheckoutBody, CheckoutHeaders } from './schemas.js';
import { placeOrder } from './service.js';

export const checkoutRoutes =
  (context: AppContext): FastifyPluginCallbackTypebox =>
  (app, _options, done) => {
    app.post(
      '/carts/:cartId/checkout',
      {
        schema: {
          tags: ['Checkout'],
          summary: 'Check out a cart (idempotent)',
          description:
            '201 on first success. A retry with the same Idempotency-Key and body returns 200 with ' +
            'the same order and an `Idempotent-Replayed: true` header.',
          params: CartIdParams,
          headers: CheckoutHeaders,
          body: CheckoutBody,
          response: {
            200: OrderSchema,
            201: OrderSchema,
            ...errorResponses(400, 402, 404, 409, 422),
          },
        },
      },
      async (request, reply) => {
        const { order, isReplay } = await placeOrder(context, {
          cartId: request.params.cartId,
          idempotencyKey: request.headers['idempotency-key'],
          ...request.body,
        });
        if (isReplay) void reply.header('Idempotent-Replayed', 'true');
        return reply.code(isReplay ? 200 : 201).send(toOrderDto(order));
      },
    );
    done();
  };
