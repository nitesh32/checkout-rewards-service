import type { paths } from './apiSchema';

type JsonBody<Operation, Status extends number> = Operation extends {
  responses: Record<Status, { content: { 'application/json': infer Body } }>;
}
  ? Body
  : never;

/** Response types derived from the generated OpenAPI schema; nothing here is hand-written. */
export type Cart = JsonBody<paths['/carts/{cartId}']['get'], 200>;
export type CartLine = Cart['lines'][number];
export type Product = JsonBody<paths['/products/{productId}']['get'], 200>;
export type ProductPage = JsonBody<paths['/products']['get'], 200>;
export type Order = JsonBody<paths['/orders/{orderId}']['get'], 200>;
export type Reward = JsonBody<paths['/rewards']['get'], 200>[number];
export type CheckoutQuote = JsonBody<paths['/carts/{cartId}/quote']['get'], 200>;
