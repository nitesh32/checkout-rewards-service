import { describe, expect, it } from 'vitest';
import { calculateDiscountMinor, multiplyMinor, sumMinor } from '../src/shared/money.js';

describe('money', () => {
  it('rounds the discount down, so it never exceeds the promised percentage', () => {
    expect(calculateDiscountMinor(999, 10)).toBe(99); // 99.9 -> 99
    expect(calculateDiscountMinor(1, 10)).toBe(0);
    expect(calculateDiscountMinor(333, 33)).toBe(109); // 109.89 -> 109
  });

  it('is exact where binary floats are not (0.1 + 0.2 style traps)', () => {
    expect(sumMinor([10, 20])).toBe(30);
    expect(calculateDiscountMinor(1_000_000_000_007, 15)).toBe(150_000_000_001);
  });

  it('can discount a whole order but never beyond it', () => {
    expect(calculateDiscountMinor(12_345, 100)).toBe(12_345);
    expect(calculateDiscountMinor(0, 50)).toBe(0);
  });

  it('rejects fractional or unsafe amounts instead of silently rounding them', () => {
    expect(() => multiplyMinor(10.5, 2)).toThrow(RangeError);
    expect(() => multiplyMinor(Number.MAX_SAFE_INTEGER, 2)).toThrow(RangeError);
    expect(() => calculateDiscountMinor(100, 101)).toThrow(RangeError);
    expect(() => calculateDiscountMinor(100, 12.5)).toThrow(RangeError);
  });
});
