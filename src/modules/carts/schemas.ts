import { Type, type Static } from '@sinclair/typebox';
import { DateTimeString, MinorAmount, ObjectIdString } from '../../shared/schemas.js';

export const MAX_LINE_QUANTITY = 100;

const Quantity = Type.Integer({ minimum: 1, maximum: MAX_LINE_QUANTITY });

export const CartLineSchema = Type.Object({
  productId: ObjectIdString,
  sku: Type.String(),
  name: Type.String(),
  unitPriceMinor: MinorAmount,
  quantity: Quantity,
  lineTotalMinor: MinorAmount,
  availableStock: Type.Integer({ minimum: 0 }),
  isPurchasable: Type.Boolean({ description: 'False when current stock is below the quantity' }),
});

export const CartSchema = Type.Object({
  id: ObjectIdString,
  status: Type.Union([Type.Literal('OPEN'), Type.Literal('CHECKED_OUT')]),
  orderId: Type.Union([ObjectIdString, Type.Null()]),
  lines: Type.Array(CartLineSchema),
  subtotalMinor: MinorAmount,
  currency: Type.String(),
  createdAt: DateTimeString,
  updatedAt: DateTimeString,
});
export type CartDto = Static<typeof CartSchema>;

export const CartIdParams = Type.Object({ cartId: ObjectIdString });
export const CartItemParams = Type.Object({ cartId: ObjectIdString, productId: ObjectIdString });

export const AddCartItemBody = Type.Object({ productId: ObjectIdString, quantity: Quantity });
export type AddCartItemBody = Static<typeof AddCartItemBody>;

export const UpdateCartItemBody = Type.Object({ quantity: Quantity });
export type UpdateCartItemBody = Static<typeof UpdateCartItemBody>;
