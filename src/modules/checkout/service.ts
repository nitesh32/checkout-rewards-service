import { createHash } from 'node:crypto';
import { ObjectId, type ClientSession } from 'mongodb';
import type { AppContext } from '../../context.js';
import type { CouponDoc, OrderDoc, OrderLineDoc } from '../../db/collections.js';
import { isDuplicateKeyError, withTransaction } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { CURRENCY, calculateDiscountMinor, sumMinor } from '../../shared/money.js';
import { priceCartItems, productIdsOf, type PricedLine } from '../carts/pricing.js';
import { unlockMilestoneReward } from '../coupons/service.js';
import { findProductsById, toStockShortage } from '../products/service.js';
import type { CheckoutBody } from './schemas.js';

export interface PlaceOrderRequest extends CheckoutBody {
  cartId: string;
  idempotencyKey: string;
}

export interface PlacedOrder {
  order: OrderDoc;
  /** True when an earlier request with the same idempotency key already created this order. */
  isReplay: boolean;
}

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Identifies "the same request" for idempotency: same cart, coupon and price expectation. */
function hashRequest({ cartId, couponCode, expectedTotalMinor }: PlaceOrderRequest): string {
  const canonical = JSON.stringify({
    cartId,
    couponCode: couponCode ? normalizeCouponCode(couponCode) : null,
    expectedTotalMinor: expectedTotalMinor ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

async function findReplay(
  { collections }: AppContext,
  idempotencyKey: string,
  requestHash: string,
): Promise<OrderDoc | null> {
  const order = await collections.orders.findOne({ idempotencyKey });
  if (!order) return null;
  if (order.requestHash !== requestHash) {
    throw new AppError(
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used for a different checkout request',
    );
  }
  return order;
}

/** Marks the cart checked out; whichever checkout does this first owns the cart. */
async function claimCart(
  context: AppContext,
  cartId: ObjectId,
  orderId: ObjectId,
  session: ClientSession,
) {
  const { carts } = context.collections;
  const cart = await carts.findOneAndUpdate(
    { _id: cartId, status: 'OPEN' },
    { $set: { status: 'CHECKED_OUT', orderId, updatedAt: new Date() } },
    { session },
  );
  if (cart) return cart;

  const existing = await carts.findOne({ _id: cartId }, { session });
  if (!existing)
    throw new AppError('CART_NOT_FOUND', `Cart ${cartId.toHexString()} does not exist`);
  throw new AppError('CART_ALREADY_CHECKED_OUT', 'This cart has already been checked out', {
    orderId: existing.orderId?.toHexString() ?? null,
  });
}

async function redeemCoupon(
  { collections }: AppContext,
  code: string,
  orderId: ObjectId,
  session: ClientSession,
): Promise<CouponDoc> {
  const redeemed = await collections.coupons.findOneAndUpdate(
    { code, status: 'AVAILABLE' },
    { $set: { status: 'REDEEMED', redeemedAt: new Date(), redeemedByOrderId: orderId } },
    { session, returnDocument: 'after' },
  );
  if (redeemed) return redeemed;

  throw unusableCouponError(await collections.coupons.findOne({ code }, { session }), code);
}

/** Explains why a code cannot be used: it does not exist, or it has already been redeemed. */
function unusableCouponError(coupon: CouponDoc | null, code: string): AppError {
  return coupon
    ? new AppError('COUPON_ALREADY_REDEEMED', `Coupon ${code} has already been redeemed`)
    : new AppError('COUPON_NOT_FOUND', `Coupon ${code} does not exist`);
}

/** The only place an order's discount and total are derived: used by quotes and by checkout. */
export function calculateTotals(
  subtotalMinor: number,
  percentOff: number | null,
): { discountMinor: number; totalMinor: number } {
  const discountMinor = percentOff === null ? 0 : calculateDiscountMinor(subtotalMinor, percentOff);
  return { discountMinor, totalMinor: subtotalMinor - discountMinor };
}

/** Conditional decrement: a unit is only taken if enough stock remains at write time. */
async function reserveStock(
  { collections }: AppContext,
  lines: readonly PricedLine[],
  session: ClientSession,
): Promise<void> {
  const shortages = [];
  const ordered = [...lines].sort((a, b) =>
    a.product._id.toHexString().localeCompare(b.product._id.toHexString()),
  );
  for (const { product, quantity } of ordered) {
    const { modifiedCount } = await collections.products.updateOne(
      { _id: product._id, stock: { $gte: quantity } },
      { $inc: { stock: -quantity }, $set: { updatedAt: new Date() } },
      { session },
    );
    if (modifiedCount === 0) shortages.push(toStockShortage(product, quantity));
  }
  if (shortages.length > 0) {
    throw new AppError(
      'INSUFFICIENT_STOCK',
      `Not enough stock for ${shortages.length} item(s)`,
      shortages,
    );
  }
}

function toOrderLine({ product, quantity, lineTotalMinor }: PricedLine): OrderLineDoc {
  return {
    productId: product._id,
    sku: product.sku,
    name: product.name,
    unitPriceMinor: product.unitPriceMinor,
    quantity,
    lineTotalMinor,
  };
}

/** Every write below shares one transaction: any thrown error rolls all of them back. */
async function createOrder(
  context: AppContext,
  request: PlaceOrderRequest,
  requestHash: string,
  session: ClientSession,
): Promise<OrderDoc> {
  const { collections, paymentProvider } = context;
  const orderId = new ObjectId();

  const cart = await claimCart(context, new ObjectId(request.cartId), orderId, session);
  if (cart.items.length === 0) throw new AppError('CART_EMPTY', 'Cannot check out an empty cart');

  const productsById = await findProductsById(context, productIdsOf(cart.items), session);
  const lines = priceCartItems(cart.items, productsById);
  const subtotalMinor = sumMinor(lines.map((line) => line.lineTotalMinor));

  const coupon = request.couponCode
    ? await redeemCoupon(context, normalizeCouponCode(request.couponCode), orderId, session)
    : null;
  const { discountMinor, totalMinor } = calculateTotals(subtotalMinor, coupon?.percentOff ?? null);

  if (request.expectedTotalMinor !== undefined && request.expectedTotalMinor !== totalMinor) {
    throw new AppError('PRICE_CHANGED', 'The total no longer matches what you expected', {
      expectedTotalMinor: request.expectedTotalMinor,
      actualTotalMinor: totalMinor,
    });
  }

  await reserveStock(context, lines, session);

  const payment = await paymentProvider.charge({ orderId, amountMinor: totalMinor });
  if (payment.status !== 'SUCCEEDED') {
    throw new AppError('PAYMENT_DECLINED', 'The payment was declined');
  }

  const counter = await collections.counters.findOneAndUpdate(
    { _id: 'orders' },
    { $inc: { seq: 1 } },
    { session, returnDocument: 'after' },
  );
  if (!counter) throw new Error('Order counter document is missing; run database setup');
  const unlockedReward = await unlockMilestoneReward(context, counter.seq, session);

  const order: OrderDoc = {
    _id: orderId,
    orderNumber: counter.seq,
    cartId: cart._id,
    idempotencyKey: request.idempotencyKey,
    requestHash,
    items: lines.map(toOrderLine),
    subtotalMinor,
    discountMinor,
    totalMinor,
    currency: CURRENCY,
    ...(coupon ? { coupon: { code: coupon.code, percentOff: coupon.percentOff } } : {}),
    ...(unlockedReward
      ? { unlockedReward: { code: unlockedReward.code, percentOff: unlockedReward.percentOff } }
      : {}),
    status: 'PLACED',
    payment: { provider: payment.provider, status: 'SUCCEEDED' },
    placedAt: new Date(),
  };
  await collections.orders.insertOne(order, { session });
  return order;
}

/**
 * A losing concurrent attempt fails either on the unique idempotency-key index or because the
 * winner already claimed the cart. Either way, if the winner used the same key we replay it.
 */
function mayBeLostRace(error: unknown): boolean {
  return (
    isDuplicateKeyError(error) ||
    (error instanceof AppError && error.code === 'CART_ALREADY_CHECKED_OUT')
  );
}

export async function placeOrder(
  context: AppContext,
  request: PlaceOrderRequest,
): Promise<PlacedOrder> {
  const requestHash = hashRequest(request);

  const replay = await findReplay(context, request.idempotencyKey, requestHash);
  if (replay) return { order: replay, isReplay: true };

  try {
    const order = await withTransaction(context.client, (session) =>
      createOrder(context, request, requestHash, session),
    );
    return { order, isReplay: false };
  } catch (error) {
    if (!mayBeLostRace(error)) throw error;
    const winner = await findReplay(context, request.idempotencyKey, requestHash);
    if (!winner) throw error;
    return { order: winner, isReplay: true };
  }
}

export interface CheckoutQuote {
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  coupon: { code: string; percentOff: number } | null;
}

/**
 * What checkout would charge right now, optionally with a reward code. Read-only: nothing is
 * reserved or redeemed, so placing the order re-checks everything inside its transaction.
 */
export async function quoteCheckout(
  context: AppContext,
  cartId: string,
  couponCode: string | undefined,
): Promise<CheckoutQuote> {
  const { carts, coupons } = context.collections;
  const cart = await carts.findOne({ _id: new ObjectId(cartId) });
  if (!cart) throw new AppError('CART_NOT_FOUND', `Cart ${cartId} does not exist`);
  if (cart.status !== 'OPEN') {
    throw new AppError('CART_NOT_OPEN', 'This cart has already been checked out', {
      orderId: cart.orderId?.toHexString() ?? null,
    });
  }

  const productsById = await findProductsById(context, productIdsOf(cart.items));
  const lines = priceCartItems(cart.items, productsById);
  const subtotalMinor = sumMinor(lines.map((line) => line.lineTotalMinor));

  let coupon: CouponDoc | null = null;
  if (couponCode) {
    const code = normalizeCouponCode(couponCode);
    coupon = await coupons.findOne({ code });
    if (coupon?.status !== 'AVAILABLE') throw unusableCouponError(coupon, code);
  }

  return {
    subtotalMinor,
    ...calculateTotals(subtotalMinor, coupon?.percentOff ?? null),
    currency: CURRENCY,
    coupon: coupon ? { code: coupon.code, percentOff: coupon.percentOff } : null,
  };
}
