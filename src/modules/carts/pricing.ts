import type { ObjectId } from 'mongodb';
import type { CartItemDoc, ProductDoc } from '../../db/collections.js';
import { AppError } from '../../shared/errors.js';
import { multiplyMinor } from '../../shared/money.js';

export interface PricedLine {
  product: ProductDoc;
  quantity: number;
  lineTotalMinor: number;
}

/** Prices cart items at the products' current unit price. Used by both cart view and checkout. */
export function priceCartItems(
  items: readonly CartItemDoc[],
  productsById: ReadonlyMap<string, ProductDoc>,
): PricedLine[] {
  return items.map(({ productId, quantity }) => {
    const product = productsById.get(productId.toHexString());
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', `Product ${productId.toHexString()} does not exist`);
    }
    return { product, quantity, lineTotalMinor: multiplyMinor(product.unitPriceMinor, quantity) };
  });
}

export function productIdsOf(items: readonly CartItemDoc[]): ObjectId[] {
  return items.map((item) => item.productId);
}
