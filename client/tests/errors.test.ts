import { ApiError } from '@/lib/api';
import { plainText } from './helpers/plainText';
import {
  describeError,
  describePriceChange,
  existingOrderIdOf,
  priceChangeOf,
  stockShortagesOf,
} from '@/lib/errors';

describe('describeError', () => {
  it('maps known codes to customer-facing copy', () => {
    const copy = describeError(new ApiError(409, 'INSUFFICIENT_STOCK', 'raw backend message'));
    expect(copy.title).toBe('Not enough stock');
  });

  it('falls back to the server message for unknown codes', () => {
    const copy = describeError(new ApiError(418, 'BREWING', 'I am a teapot'));
    expect(copy.description).toBe('I am a teapot');
  });

  it('treats non-API errors as a generic failure', () => {
    expect(describeError(new Error('boom')).title).toBe('Something went wrong');
  });

  it('explains a network failure as safe to retry', () => {
    expect(describeError(new ApiError(0, 'NETWORK_ERROR', 'offline')).description).toMatch(
      /not be duplicated/,
    );
  });
});

describe('error details', () => {
  const shortage = { productId: 'p1', sku: 'LAMP', requested: 2, available: 1 };

  it('reads stock shortages only from an INSUFFICIENT_STOCK error', () => {
    expect(stockShortagesOf(new ApiError(409, 'INSUFFICIENT_STOCK', 'x', [shortage]))).toEqual([
      shortage,
    ]);
    expect(stockShortagesOf(new ApiError(409, 'PRICE_CHANGED', 'x', [shortage]))).toBeNull();
  });

  it('ignores malformed details instead of trusting them', () => {
    expect(
      stockShortagesOf(new ApiError(409, 'INSUFFICIENT_STOCK', 'x', [{ sku: 'LAMP' }])),
    ).toBeNull();
    expect(priceChangeOf(new ApiError(409, 'PRICE_CHANGED', 'x', 'nope'))).toBeNull();
  });

  it('describes a price change using both totals', () => {
    const change = priceChangeOf(
      new ApiError(409, 'PRICE_CHANGED', 'x', {
        expectedTotalMinor: 4_000,
        actualTotalMinor: 5_000,
      }),
    );
    expect(change).not.toBeNull();
    if (change)
      expect(plainText(describePriceChange(change))).toBe(
        'You expected ₹40, but the total is now ₹50.',
      );
  });

  it('finds the existing order of an already checked-out cart', () => {
    expect(
      existingOrderIdOf(new ApiError(409, 'CART_ALREADY_CHECKED_OUT', 'x', { orderId: 'o1' })),
    ).toBe('o1');
    expect(
      existingOrderIdOf(new ApiError(409, 'CART_ALREADY_CHECKED_OUT', 'x', { orderId: null })),
    ).toBeNull();
  });
});
