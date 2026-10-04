import { Type, type Static } from '@sinclair/typebox';
import { CartIdParams } from '../carts/schemas.js';

export { CartIdParams };

export const CheckoutHeaders = Type.Object({
  'idempotency-key': Type.String({
    minLength: 8,
    maxLength: 128,
    description: 'Client-generated key (e.g. a UUID). Reuse it when retrying the same checkout.',
  }),
});

export const CheckoutBody = Type.Object({
  couponCode: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  expectedTotalMinor: Type.Optional(
    Type.Integer({
      minimum: 0,
      description: 'If set and the computed total differs, checkout fails with PRICE_CHANGED',
    }),
  ),
});
export type CheckoutBody = Static<typeof CheckoutBody>;
