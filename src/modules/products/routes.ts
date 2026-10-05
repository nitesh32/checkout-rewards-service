import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { AppContext } from '../../context.js';
import { errorResponses, pageOf } from '../../shared/schemas.js';
import { ListProductsQuery, ProductIdParams, ProductSchema } from './schemas.js';
import { getProduct, listProducts } from './service.js';

export const productRoutes =
  (context: AppContext): FastifyPluginCallbackTypebox =>
  (app, _options, done) => {
    app.get(
      '/products',
      {
        schema: {
          tags: ['Products'],
          summary: 'List products (cursor paginated)',
          querystring: ListProductsQuery,
          response: { 200: pageOf(ProductSchema), ...errorResponses(400) },
        },
      },
      (request) => listProducts(context, request.query),
    );

    app.get(
      '/products/:productId',
      {
        schema: {
          tags: ['Products'],
          summary: 'Get a product',
          params: ProductIdParams,
          response: { 200: ProductSchema, ...errorResponses(400, 404) },
        },
      },
      (request) => getProduct(context, request.params.productId),
    );
    done();
  };
