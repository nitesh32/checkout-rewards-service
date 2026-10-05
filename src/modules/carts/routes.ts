import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { AppContext } from '../../context.js';
import { errorResponses } from '../../shared/schemas.js';
import {
  AddCartItemBody,
  CartIdParams,
  CartItemParams,
  CartSchema,
  UpdateCartItemBody,
} from './schemas.js';
import {
  addCartItem,
  createCart,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from './service.js';

export const cartRoutes =
  (context: AppContext): FastifyPluginCallbackTypebox =>
  (app, _options, done) => {
    app.post(
      '/carts',
      {
        schema: {
          tags: ['Carts'],
          summary: 'Create an empty cart',
          response: { 201: CartSchema },
        },
      },
      async (_request, reply) => reply.code(201).send(await createCart(context)),
    );

    app.get(
      '/carts/:cartId',
      {
        schema: {
          tags: ['Carts'],
          summary: 'View a cart with live prices, totals and per-line availability',
          params: CartIdParams,
          response: { 200: CartSchema, ...errorResponses(400, 404) },
        },
      },
      (request) => getCart(context, request.params.cartId),
    );

    app.post(
      '/carts/:cartId/items',
      {
        schema: {
          tags: ['Carts'],
          summary: 'Add a product (merges into an existing line)',
          params: CartIdParams,
          body: AddCartItemBody,
          response: { 200: CartSchema, ...errorResponses(400, 404, 409, 422) },
        },
      },
      (request) => addCartItem(context, request.params.cartId, request.body),
    );

    app.patch(
      '/carts/:cartId/items/:productId',
      {
        schema: {
          tags: ['Carts'],
          summary: 'Set the absolute quantity of a line',
          params: CartItemParams,
          body: UpdateCartItemBody,
          response: { 200: CartSchema, ...errorResponses(400, 404, 409, 422) },
        },
      },
      (request) =>
        updateCartItemQuantity(
          context,
          request.params.cartId,
          request.params.productId,
          request.body,
        ),
    );

    app.delete(
      '/carts/:cartId/items/:productId',
      {
        schema: {
          tags: ['Carts'],
          summary: 'Remove a line (404 if the product is not in the cart)',
          params: CartItemParams,
          response: { 200: CartSchema, ...errorResponses(400, 404, 409) },
        },
      },
      (request) => removeCartItem(context, request.params.cartId, request.params.productId),
    );
    done();
  };
