/**
 * All money is an integer count of minor units (paise). This is the only module that does
 * money arithmetic, so a float can never enter an order total.
 */
export const CURRENCY = 'INR';

function assertMinor(amountMinor: number, label: string): void {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(`${label} must be a safe integer in minor units, received ${amountMinor}`);
  }
}

export function sumMinor(amountsMinor: readonly number[]): number {
  return amountsMinor.reduce((total, amountMinor) => {
    assertMinor(amountMinor, 'amount');
    const next = total + amountMinor;
    assertMinor(next, 'sum');
    return next;
  }, 0);
}

export function multiplyMinor(unitPriceMinor: number, quantity: number): number {
  assertMinor(unitPriceMinor, 'unit price');
  assertMinor(quantity, 'quantity');
  const product = unitPriceMinor * quantity;
  assertMinor(product, 'line total');
  return product;
}

/**
 * Percentage discount on a subtotal, rounded down: deterministic, never exceeds the percentage
 * promised, and clamped so the discount can never exceed the subtotal.
 */
export function calculateDiscountMinor(subtotalMinor: number, percentOff: number): number {
  assertMinor(subtotalMinor, 'subtotal');
  if (!Number.isInteger(percentOff) || percentOff < 0 || percentOff > 100) {
    throw new RangeError(`percentOff must be an integer between 0 and 100, received ${percentOff}`);
  }
  const discountMinor = Math.floor((subtotalMinor * percentOff) / 100);
  assertMinor(discountMinor, 'discount');
  return Math.min(discountMinor, subtotalMinor);
}
