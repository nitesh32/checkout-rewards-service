const DEFAULT_CURRENCY = 'INR';
const MINOR_UNITS_PER_MAJOR = 100;

const formatters = new Map<string, Intl.NumberFormat>();
const WHOLE_UNIT_KEY_SUFFIX = ':whole';

function formatterFor(currency: string, isWholeAmount: boolean): Intl.NumberFormat {
  const cacheKey = isWholeAmount ? currency + WHOLE_UNIT_KEY_SUFFIX : currency;
  const existing = formatters.get(cacheKey);
  if (existing) return existing;
  const created = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: isWholeAmount ? 0 : 2,
  });
  formatters.set(cacheKey, created);
  return created;
}

/** Formats integer minor units (paise). Whole rupees drop the decimals: ₹249, but ₹149.50. */
export function formatMoney(amountMinor: number, currency: string = DEFAULT_CURRENCY): string {
  const isWholeAmount = amountMinor % MINOR_UNITS_PER_MAJOR === 0;
  return formatterFor(currency, isWholeAmount).format(amountMinor / MINOR_UNITS_PER_MAJOR);
}
