import { ObjectId, type ClientSession } from 'mongodb';
import type { AppContext } from '../../context.js';
import type { CartDoc, CartItemDoc, ProductDoc } from '../../db/collections.js';
import { withTransaction } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { CURRENCY, sumMinor } from '../../shared/money.js';
import { findProductsById, requireProduct, toStockShortage } from '../products/service.js';
import { priceCartItems, productIdsOf } from './pricing.js';
import {
  MAX_LINE_QUANTITY,
  type AddCartItemBody,
  type CartDto,
  type UpdateCartItemBody,
} from './schemas.js';

async function toCartDto(context: AppContext, cart: CartDoc): Promise<CartDto> {
  const productsById = await findProductsById(context, productIdsOf(cart.items));
  const lines = priceCartItems(cart.items, productsById).map(
    ({ product, quantity, lineTotalMinor }) => ({
      productId: product._id.toHexString(),
      sku: product.sku,
      name: product.name,
      unitPriceMinor: product.unitPriceMinor,
      quantity,
      lineTotalMinor,
      availableStock: product.stock,
      isPurchasable: product.stock >= quantity,
    }),
  );
  return {
    id: cart._id.toHexString(),
    status: cart.status,
    orderId: cart.orderId?.toHexString() ?? null,
    lines,
    subtotalMinor: sumMinor(lines.map((line) => line.lineTotalMinor)),
    currency: CURRENCY,
    createdAt: cart.createdAt.toISOString(),
    updatedAt: cart.updatedAt.toISOString(),
  };
}

function assertQuantityAllowed(product: ProductDoc, quantity: number): void {
  if (quantity > product.stock) {
    throw new AppError('INSUFFICIENT_STOCK', `Not enough stock for ${product.sku}`, [
      toStockShortage(product, quantity),
    ]);
  }
  if (quantity > MAX_LINE_QUANTITY) {
    throw new AppError(
      'QUANTITY_LIMIT_EXCEEDED',
      `A cart line may hold at most ${MAX_LINE_QUANTITY} units`,
      { productId: product._id.toHexString(), requested: quantity, max: MAX_LINE_QUANTITY },
    );
  }
}

function withQuantity(
  items: readonly CartItemDoc[],
  productId: ObjectId,
  quantity: number,
): CartItemDoc[] {
  const isExisting = items.some((item) => item.productId.equals(productId));
  return isExisting
    ? items.map((item) => (item.productId.equals(productId) ? { ...item, quantity } : item))
    : [...items, { productId, quantity }];
}

function requireItem(items: readonly CartItemDoc[], productId: ObjectId): CartItemDoc {
  const item = items.find((candidate) => candidate.productId.equals(productId));
  if (!item) {
    throw new AppError(
      'CART_ITEM_NOT_FOUND',
      `Product ${productId.toHexString()} is not in this cart`,
    );
  }
  return item;
}

/**
 * Edits an open cart's items as one read-modify-write transaction. A concurrent edit or
 * checkout of the same cart is a write conflict, so the driver re-runs this with fresh data.
 */
async function editCartItems(
  context: AppContext,
  cartId: string,
  edit: (items: CartItemDoc[], session: ClientSession) => Promise<CartItemDoc[]>,
): Promise<CartDto> {
  const { carts } = context.collections;
  const cart = await withTransaction(context.client, async (session) => {
    const current = await carts.findOne({ _id: new ObjectId(cartId) }, { session });
    if (!current) throw new AppError('CART_NOT_FOUND', `Cart ${cartId} does not exist`);
    if (current.status !== 'OPEN') {
      throw new AppError('CART_NOT_OPEN', 'This cart has already been checked out', {
        orderId: current.orderId?.toHexString() ?? null,
      });
    }
    const items = await edit(current.items, session);
    const updatedAt = new Date();
    await carts.updateOne({ _id: current._id }, { $set: { items, updatedAt } }, { session });
    return { ...current, items, updatedAt };
  });
  return toCartDto(context, cart);
}

export async function createCart(context: AppContext): Promise<CartDto> {
  const now = new Date();
  const cart: CartDoc = {
    _id: new ObjectId(),
    status: 'OPEN',
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  await context.collections.carts.insertOne(cart);
  return toCartDto(context, cart);
}

export async function getCart(context: AppContext, cartId: string): Promise<CartDto> {
  const cart = await context.collections.carts.findOne({ _id: new ObjectId(cartId) });
  if (!cart) throw new AppError('CART_NOT_FOUND', `Cart ${cartId} does not exist`);
  return toCartDto(context, cart);
}

/** Adding a product already in the cart merges into its line. */
export function addCartItem(
  context: AppContext,
  cartId: string,
  body: AddCartItemBody,
): Promise<CartDto> {
  const productId = new ObjectId(body.productId);
  return editCartItems(context, cartId, async (items, session) => {
    const product = await requireProduct(context, productId, session);
    const existing = items.find((item) => item.productId.equals(productId));
    const quantity = (existing?.quantity ?? 0) + body.quantity;
    assertQuantityAllowed(product, quantity);
    return withQuantity(items, productId, quantity);
  });
}

/** Sets an absolute quantity; use removeCartItem to take a line out. */
export function updateCartItemQuantity(
  context: AppContext,
  cartId: string,
  productId: string,
  { quantity }: UpdateCartItemBody,
): Promise<CartDto> {
  const id = new ObjectId(productId);
  return editCartItems(context, cartId, async (items, session) => {
    requireItem(items, id);
    assertQuantityAllowed(await requireProduct(context, id, session), quantity);
    return withQuantity(items, id, quantity);
  });
}

export function removeCartItem(
  context: AppContext,
  cartId: string,
  productId: string,
): Promise<CartDto> {
  const id = new ObjectId(productId);
  return editCartItems(context, cartId, (items) => {
    requireItem(items, id);
    return Promise.resolve(items.filter((item) => !item.productId.equals(id)));
  });
}
