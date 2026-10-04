import { ApiError, NETWORK_ERROR_CODE, UNKNOWN_ERROR_CODE } from './api';
import { formatMoney } from './money';

export interface ErrorCopy {
  title: string;
  description: string;
}

/** What a customer should read for each backend error code. */
const ERROR_COPY: Record<string, ErrorCopy> = {
  VALIDATION_ERROR: { title: 'Check your input', description: 'Some of the values are not valid.' },
  BAD_REQUEST: { title: 'Invalid request', description: 'The request could not be understood.' },
  INVALID_CURSOR: { title: 'Page expired', description: 'Reload the list and try again.' },
  PRODUCT_NOT_FOUND: { title: 'Product not found', description: 'This product no longer exists.' },
  CART_NOT_FOUND: { title: 'Cart not found', description: 'We could not find your cart.' },
  CART_ITEM_NOT_FOUND: {
    title: 'Item not in cart',
    description: 'That item is no longer in your cart.',
  },
  ORDER_NOT_FOUND: { title: 'Order not found', description: 'We could not find that order.' },
  COUPON_NOT_FOUND: { title: 'Coupon not found', description: 'Check the code and try again.' },
  COUPON_ALREADY_REDEEMED: {
    title: 'Coupon already used',
    description: 'This coupon has already been redeemed. Remove it to continue without a discount.',
  },
  CART_NOT_OPEN: {
    title: 'Cart already checked out',
    description: 'This cart has been ordered. Start a new cart to keep shopping.',
  },
  CART_ALREADY_CHECKED_OUT: {
    title: 'This cart was already ordered',
    description: 'An order has already been placed for this cart.',
  },
  CART_EMPTY: { title: 'Your cart is empty', description: 'Add something before checking out.' },
  INSUFFICIENT_STOCK: {
    title: 'Not enough stock',
    description: 'Some items are no longer available in the quantity you chose.',
  },
  PRICE_CHANGED: {
    title: 'The price changed',
    description: 'The total is different from what you were shown.',
  },
  QUANTITY_LIMIT_EXCEEDED: {
    title: 'Quantity limit reached',
    description: 'You can buy at most 100 units of one product.',
  },
  IDEMPOTENCY_KEY_REUSED: {
    title: 'Checkout already in progress',
    description: 'Reload the page and try again.',
  },
  PAYMENT_DECLINED: {
    title: 'Payment declined',
    description: 'Your payment was not accepted. Nothing was charged.',
  },
  [NETWORK_ERROR_CODE]: {
    title: 'You appear to be offline',
    description: 'Check your connection and retry. Your request will not be duplicated.',
  },
  [UNKNOWN_ERROR_CODE]: {
    title: 'Something went wrong',
    description: 'Please try again in a moment.',
  },
};

const FALLBACK_COPY: ErrorCopy = {
  title: 'Something went wrong',
  description: 'Please try again in a moment.',
};

export function describeError(error: unknown): ErrorCopy {
  if (error instanceof ApiError)
    return ERROR_COPY[error.code] ?? { title: FALLBACK_COPY.title, description: error.message };
  return FALLBACK_COPY;
}

export interface StockShortage {
  productId: string;
  sku: string;
  requested: number;
  available: number;
}

export interface PriceChange {
  expectedTotalMinor: number;
  actualTotalMinor: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStockShortage(value: unknown): value is StockShortage {
  return (
    isRecord(value) &&
    typeof value['productId'] === 'string' &&
    typeof value['sku'] === 'string' &&
    typeof value['requested'] === 'number' &&
    typeof value['available'] === 'number'
  );
}

function isStockShortages(value: unknown): value is StockShortage[] {
  return Array.isArray(value) && value.every(isStockShortage);
}

function isPriceChange(value: unknown): value is PriceChange {
  return (
    isRecord(value) &&
    typeof value['expectedTotalMinor'] === 'number' &&
    typeof value['actualTotalMinor'] === 'number'
  );
}

/** Returns an error's `details` only when it carries the expected code and shape. */
function detailsOf<T>(
  error: unknown,
  code: string,
  isShape: (value: unknown) => value is T,
): T | null {
  return error instanceof ApiError && error.code === code && isShape(error.details)
    ? error.details
    : null;
}

export const stockShortagesOf = (error: unknown): StockShortage[] | null =>
  detailsOf(error, 'INSUFFICIENT_STOCK', isStockShortages);

export const priceChangeOf = (error: unknown): PriceChange | null =>
  detailsOf(error, 'PRICE_CHANGED', isPriceChange);

export function existingOrderIdOf(error: unknown): string | null {
  const details =
    error instanceof ApiError && error.code === 'CART_ALREADY_CHECKED_OUT' ? error.details : null;
  return isRecord(details) && typeof details['orderId'] === 'string' ? details['orderId'] : null;
}

export function describePriceChange({ expectedTotalMinor, actualTotalMinor }: PriceChange): string {
  return `You expected ${formatMoney(expectedTotalMinor)}, but the total is now ${formatMoney(actualTotalMinor)}.`;
}
