const ORDER_NUMBER_DIGITS = 5;

/** Presentation of the backend's sequential order number, e.g. 12 becomes MRG-00012. */
export function formatOrderNumber(orderNumber: number): string {
  return `MRG-${String(orderNumber).padStart(ORDER_NUMBER_DIGITS, '0')}`;
}
