import { Type, type TSchema } from '@sinclair/typebox';

export const ObjectIdString = Type.String({
  pattern: '^[a-f0-9]{24}$',
  description: 'ObjectId hex',
});
export const DateTimeString = Type.String({ format: 'date-time' });
export const MinorAmount = Type.Integer({
  minimum: 0,
  description: 'Amount in minor units (paise)',
});

export const ErrorResponse = Type.Object(
  {
    error: Type.Object({
      code: Type.String(),
      message: Type.String(),
      details: Type.Optional(Type.Unknown()),
    }),
  },
  { $id: 'ErrorResponse' },
);

/** Declares the standard error body for each given status code in a route's response schema. */
export function errorResponses(...statusCodes: number[]): Record<number, typeof ErrorResponse> {
  return Object.fromEntries(statusCodes.map((statusCode) => [statusCode, ErrorResponse]));
}

export const PageQuery = Type.Object({
  limit: Type.Integer({ minimum: 1, maximum: 100, default: 20 }),
  cursor: Type.Optional(Type.String({ description: 'Opaque cursor from a previous page' })),
});

export function pageOf<T extends TSchema>(item: T) {
  return Type.Object({
    data: Type.Array(item),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
  });
}
