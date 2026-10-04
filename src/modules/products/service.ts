import { ObjectId, type ClientSession, type Filter } from 'mongodb';
import type { AppContext } from '../../context.js';
import type { ProductDoc } from '../../db/collections.js';
import { AppError } from '../../shared/errors.js';
import { CURRENCY } from '../../shared/money.js';
import { findPage, type Page } from '../../shared/pagination.js';
import type { ListProductsQuery, ProductDto } from './schemas.js';

export interface StockShortage {
  productId: string;
  sku: string;
  requested: number;
  available: number;
}

export function toStockShortage(product: ProductDoc, requested: number): StockShortage {
  return {
    productId: product._id.toHexString(),
    sku: product.sku,
    requested,
    available: product.stock,
  };
}

export function toProductDto(product: ProductDoc): ProductDto {
  return {
    id: product._id.toHexString(),
    sku: product.sku,
    name: product.name,
    unitPriceMinor: product.unitPriceMinor,
    currency: CURRENCY,
    stock: product.stock,
    updatedAt: product.updatedAt.toISOString(),
  };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listProducts(
  { collections }: AppContext,
  { q, inStock, limit, cursor }: ListProductsQuery,
): Promise<Page<ProductDto>> {
  const filter: Filter<ProductDoc> = {
    ...(q ? { name: { $regex: escapeRegExp(q), $options: 'i' } } : {}),
    ...(inStock ? { stock: { $gt: 0 } } : {}),
  };
  const page = await findPage(collections.products, filter, { limit, cursor });
  return { data: page.data.map(toProductDto), nextCursor: page.nextCursor };
}

export async function getProduct(
  { collections }: AppContext,
  productId: string,
): Promise<ProductDto> {
  const product = await collections.products.findOne({ _id: new ObjectId(productId) });
  if (!product) throw new AppError('PRODUCT_NOT_FOUND', `Product ${productId} does not exist`);
  return toProductDto(product);
}

/**
 * Products are never deleted, so a cart item whose product is missing is a data error rather
 * than a business case.
 */
export async function findProductsById(
  { collections }: AppContext,
  productIds: readonly ObjectId[],
  session?: ClientSession,
): Promise<Map<string, ProductDoc>> {
  const products = await collections.products
    .find({ _id: { $in: [...productIds] } }, session ? { session } : {})
    .toArray();
  return new Map(products.map((product) => [product._id.toHexString(), product]));
}

export async function requireProduct(
  context: AppContext,
  productId: ObjectId,
  session?: ClientSession,
): Promise<ProductDoc> {
  const product = (await findProductsById(context, [productId], session)).get(
    productId.toHexString(),
  );
  if (!product) {
    throw new AppError('PRODUCT_NOT_FOUND', `Product ${productId.toHexString()} does not exist`);
  }
  return product;
}
