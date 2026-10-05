import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { AppContext } from './context.js';
import { cartRoutes } from './modules/carts/routes.js';
import { checkoutRoutes } from './modules/checkout/routes.js';
import { couponRoutes } from './modules/coupons/routes.js';
import { orderRoutes } from './modules/orders/routes.js';
import { productRoutes } from './modules/products/routes.js';
import { reportRoutes } from './modules/reports/routes.js';
import { registerErrorHandling } from './shared/errors.js';
import { tolerateEmptyJsonBodies } from './shared/http.js';

export async function buildApp(
  context: AppContext,
  logger: FastifyServerOptions['logger'] = false,
) {
  const app = Fastify({ logger }).withTypeProvider<TypeBoxTypeProvider>();

  registerErrorHandling(app);
  tolerateEmptyJsonBodies(app);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Checkout & Rewards Service',
        version: '1.0.0',
        description: 'Routes under /admin are administrative; authentication is out of scope.',
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(productRoutes(context));
  await app.register(cartRoutes(context));
  await app.register(checkoutRoutes(context));
  await app.register(orderRoutes(context));
  await app.register(couponRoutes(context));
  await app.register(reportRoutes(context));

  return app;
}
