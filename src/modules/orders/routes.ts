import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { AppContext } from '../../context.js';
import { errorResponses, pageOf } from '../../shared/schemas.js';
import { ListOrdersQuery, OrderIdParams, OrderSchema } from './schemas.js';
import { getOrder, listOrders } from './service.js';

export const orderRoutes =
  (context: AppContext): FastifyPluginCallbackTypebox =>
  (app, _options, done) => {
    app.get(
      '/orders/:orderId',
      {
        schema: {
          tags: ['Orders'],
          summary: 'Get an order snapshot',
          params: OrderIdParams,
          response: { 200: OrderSchema, ...errorResponses(400, 404) },
        },
      },
      (request) => getOrder(context, request.params.orderId),
    );

    app.get(
      '/admin/orders',
      {
        schema: {
          tags: ['Admin'],
          summary: 'List orders, newest first (admin)',
          querystring: ListOrdersQuery,
          response: { 200: pageOf(OrderSchema), ...errorResponses(400) },
        },
      },
      (request) => listOrders(context, request.query),
    );
    done();
  };
