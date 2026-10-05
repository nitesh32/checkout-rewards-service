import { Type, type Static } from '@sinclair/typebox';
import { DateTimeString, MinorAmount, ObjectIdString, PageQuery } from '../../shared/schemas.js';

export const ProductSchema = Type.Object({
  id: ObjectIdString,
  sku: Type.String(),
  name: Type.String(),
  unitPriceMinor: MinorAmount,
  currency: Type.String(),
  stock: Type.Integer({ minimum: 0 }),
  updatedAt: DateTimeString,
});
export type ProductDto = Static<typeof ProductSchema>;

export const ProductIdParams = Type.Object({ productId: ObjectIdString });

export const ListProductsQuery = Type.Composite([
  PageQuery,
  Type.Object({
    q: Type.Optional(Type.String({ minLength: 1, maxLength: 100, description: 'Name contains' })),
    inStock: Type.Optional(Type.Boolean({ description: 'Only products with stock > 0' })),
  }),
]);
export type ListProductsQuery = Static<typeof ListProductsQuery>;
