import {
  checkoutFingerprint,
  createIdempotencyKeyProvider,
} from '@/features/checkout/idempotencyKey';

const request = { cartId: 'cart-1', couponCode: undefined, expectedTotalMinor: 1_000 };

describe('createIdempotencyKeyProvider', () => {
  it('reuses the key when the same request is retried', () => {
    const keyFor = createIdempotencyKeyProvider();
    const fingerprint = checkoutFingerprint(request);
    expect(keyFor(fingerprint)).toBe(keyFor(fingerprint));
  });

  it('issues a new key when the request changes', () => {
    const keyFor = createIdempotencyKeyProvider();
    const first = keyFor(checkoutFingerprint(request));
    const withCoupon = keyFor(checkoutFingerprint({ ...request, couponCode: 'SAVE-ABCDEFGH' }));
    expect(withCoupon).not.toBe(first);
  });

  it('gives independent providers independent keys', () => {
    const fingerprint = checkoutFingerprint(request);
    expect(createIdempotencyKeyProvider()(fingerprint)).not.toBe(
      createIdempotencyKeyProvider()(fingerprint),
    );
  });
});

describe('checkoutFingerprint', () => {
  it('distinguishes carts, coupons and expected totals', () => {
    const base = checkoutFingerprint(request);
    expect(checkoutFingerprint({ ...request, cartId: 'cart-2' })).not.toBe(base);
    expect(checkoutFingerprint({ ...request, couponCode: 'X' })).not.toBe(base);
    expect(checkoutFingerprint({ ...request, expectedTotalMinor: undefined })).not.toBe(base);
  });
});
