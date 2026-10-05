interface CheckoutRequest {
  cartId: string;
  couponCode: string | undefined;
  expectedTotalMinor: number | undefined;
}

/** Two checkout attempts are "the same request" when these three values match. */
export function checkoutFingerprint({
  cartId,
  couponCode,
  expectedTotalMinor,
}: CheckoutRequest): string {
  return JSON.stringify([cartId, couponCode ?? null, expectedTotalMinor ?? null]);
}

/**
 * Hands out Idempotency-Keys for checkout attempts. Retrying the same request (for example after a
 * timeout) reuses the key, so the server can recognise it and never place a second order. A
 * changed request gets a fresh key, because the server rejects one key used for two different requests.
 */
export function createIdempotencyKeyProvider(): (fingerprint: string) => string {
  let current: { fingerprint: string; key: string } | null = null;

  return (fingerprint) => {
    if (current?.fingerprint !== fingerprint) {
      current = { fingerprint, key: crypto.randomUUID() };
    }
    return current.key;
  };
}
