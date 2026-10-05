import type { Collection, Db, ObjectId } from 'mongodb';

export interface ProductDoc {
  _id: ObjectId;
  sku: string;
  name: string;
  unitPriceMinor: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItemDoc {
  productId: ObjectId;
  quantity: number;
}

export type CartStatus = 'OPEN' | 'CHECKED_OUT';

/** Carts store no prices: they are read live until checkout snapshots them into an order. */
export interface CartDoc {
  _id: ObjectId;
  status: CartStatus;
  items: CartItemDoc[];
  orderId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderLineDoc {
  productId: ObjectId;
  sku: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
}

/** Immutable snapshot of what was bought and how the total was calculated. */
export interface OrderDoc {
  _id: ObjectId;
  orderNumber: number;
  cartId: ObjectId;
  idempotencyKey: string;
  requestHash: string;
  items: OrderLineDoc[];
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  coupon?: { code: string; percentOff: number };
  status: 'PLACED';
  payment: { provider: string; status: 'SUCCEEDED' };
  placedAt: Date;
}

export type CouponStatus = 'AVAILABLE' | 'REDEEMED';

export interface CouponDoc {
  _id: ObjectId;
  code: string;
  percentOff: number;
  milestone: number;
  status: CouponStatus;
  redeemedByOrderId?: ObjectId;
  generatedAt: Date;
  redeemedAt?: Date;
}

/** Single document counting successfully placed orders: the source of truth for milestones. */
export interface CounterDoc {
  _id: 'orders';
  seq: number;
}

export interface Collections {
  products: Collection<ProductDoc>;
  carts: Collection<CartDoc>;
  orders: Collection<OrderDoc>;
  coupons: Collection<CouponDoc>;
  counters: Collection<CounterDoc>;
}

export function getCollections(db: Db): Collections {
  return {
    products: db.collection<ProductDoc>('products'),
    carts: db.collection<CartDoc>('carts'),
    orders: db.collection<OrderDoc>('orders'),
    coupons: db.collection<CouponDoc>('coupons'),
    counters: db.collection<CounterDoc>('counters'),
  };
}
