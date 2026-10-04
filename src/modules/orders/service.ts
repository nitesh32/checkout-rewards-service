import { ObjectId, type Filter } from 'mongodb';
import type { AppContext } from '../../context.js';
import type { OrderDoc } from '../../db/collections.js';
import { AppError } from '../../shared/errors.js';
import { findPage, type Page } from '../../shared/pagination.js';
import type { ListOrdersQuery, OrderDto } from './schemas.js';

export function toOrderDto(order: OrderDoc): OrderDto {
  return {
    id: order._id.toHexString(),
    orderNumber: order.orderNumber,
    cartId: order.cartId.toHexString(),
    status: order.status,
    items: order.items.map((line) => ({ ...line, productId: line.productId.toHexString() })),
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    totalMinor: order.totalMinor,
    currency: order.currency,
    coupon: order.coupon ?? null,
    payment: order.payment,
    placedAt: order.placedAt.toISOString(),
  };
}

export async function getOrder({ collections }: AppContext, orderId: string): Promise<OrderDto> {
  const order = await collections.orders.findOne({ _id: new ObjectId(orderId) });
  if (!order) throw new AppError('ORDER_NOT_FOUND', `Order ${orderId} does not exist`);
  return toOrderDto(order);
}

/** Newest first. */
export async function listOrders(
  { collections }: AppContext,
  { from, to, couponCode, limit, cursor }: ListOrdersQuery,
): Promise<Page<OrderDto>> {
  const placedAt = {
    ...(from ? { $gte: new Date(from) } : {}),
    ...(to ? { $lte: new Date(to) } : {}),
  };
  const filter: Filter<OrderDoc> = {
    ...(from || to ? { placedAt } : {}),
    ...(couponCode ? { 'coupon.code': couponCode.trim().toUpperCase() } : {}),
  };
  const page = await findPage(collections.orders, filter, { limit, cursor }, 'desc');
  return { data: page.data.map(toOrderDto), nextCursor: page.nextCursor };
}
