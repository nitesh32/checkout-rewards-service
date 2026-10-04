import type { FastifyError, FastifyInstance } from 'fastify';

/** Single source of truth for error codes and the HTTP status each one maps to. */
const ERROR_STATUS = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  INVALID_CURSOR: 400,
  PAYMENT_DECLINED: 402,
  ROUTE_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  CART_NOT_FOUND: 404,
  CART_ITEM_NOT_FOUND: 404,
  ORDER_NOT_FOUND: 404,
  COUPON_NOT_FOUND: 404,
  CART_NOT_OPEN: 409,
  CART_ALREADY_CHECKED_OUT: 409,
  INSUFFICIENT_STOCK: 409,
  PRICE_CHANGED: 409,
  COUPON_ALREADY_REDEEMED: 409,
  NO_ELIGIBLE_MILESTONE: 409,
  CART_EMPTY: 422,
  QUANTITY_LIMIT_EXCEEDED: 422,
  IDEMPOTENCY_KEY_REUSED: 422,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class AppError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = ERROR_STATUS[code];
  }
}

function errorBody(code: ErrorCode, message: string, details?: unknown) {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

function toAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;
  const fastifyError = error as Partial<FastifyError>;
  if (fastifyError.validation) {
    const details = fastifyError.validation.map(({ instancePath, message }) => ({
      path: `${fastifyError.validationContext ?? 'request'}${instancePath}`,
      message,
    }));
    return new AppError('VALIDATION_ERROR', 'Request validation failed', details);
  }
  if (fastifyError.statusCode === 400) {
    return new AppError('BAD_REQUEST', fastifyError.message ?? 'Malformed request');
  }
  return null;
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) =>
    reply
      .code(ERROR_STATUS.ROUTE_NOT_FOUND)
      .send(errorBody('ROUTE_NOT_FOUND', `Route ${request.method} ${request.url} not found`)),
  );

  app.setErrorHandler((error, request, reply) => {
    const appError = toAppError(error);
    if (appError) {
      return reply
        .code(appError.statusCode)
        .send(errorBody(appError.code, appError.message, appError.details));
    }
    request.log.error(error);
    return reply
      .code(ERROR_STATUS.INTERNAL_ERROR)
      .send(errorBody('INTERNAL_ERROR', 'An unexpected error occurred'));
  });
}
