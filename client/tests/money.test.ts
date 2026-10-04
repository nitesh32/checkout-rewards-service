import { formatMoney } from '@/lib/money';
import { plainText } from './helpers/plainText';

describe('formatMoney', () => {
  it('drops the decimals for whole rupees and keeps two for the rest', () => {
    expect(plainText(formatMoney(24_900))).toBe('₹249');
    expect(plainText(formatMoney(29_985))).toBe('₹299.85');
    expect(plainText(formatMoney(14_950))).toBe('₹149.50');
    expect(plainText(formatMoney(5))).toBe('₹0.05');
    expect(plainText(formatMoney(0))).toBe('₹0');
  });

  it('uses Indian digit grouping for large amounts', () => {
    expect(plainText(formatMoney(123_456_789))).toBe('₹12,34,567.89');
  });
});
