import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  checkout,
  createCartWith,
  createTestApp,
  errorCodeOf,
  insertProduct,
  type TestApp,
} from './helpers/testApp.js';

interface CartBody {
  lines: { productId: string; quantity: number; unitPriceMinor: number; isPurchasable: boolean }[];
  subtotalMinor: number;
}

describe('carts', () => {
  let testApp: TestApp;
  let productId: string;
  beforeAll(async () => {
    testApp = await createTestApp();
    productId = await insertProduct(testApp, {
      sku: 'CART-ITEM',
      unitPriceMinor: 2_000,
      stock: 10,
    });
  });
  afterAll(() => testApp.close());

  const addItem = (cartId: string, payload: object) =>
    testApp.app.inject({ method: 'POST', url: `/carts/${cartId}/items`, payload });

  it('merges repeated adds into one line and totals it', async () => {
    const cartId = await createCartWith(testApp, []);
    await addItem(cartId, { productId, quantity: 2 });
    const response = await addItem(cartId, { productId, quantity: 3 });

    expect(response.json<CartBody>()).toMatchObject({
      lines: [{ productId, quantity: 5, unitPriceMinor: 2_000 }],
      subtotalMinor: 10_000,
    });
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['text', 'two'],
    ['above the line limit', 101],
  ])('rejects a %s quantity without touching the cart', async (_label, quantity) => {
    const cartId = await createCartWith(testApp, []);

    const response = await addItem(cartId, { productId, quantity });

    expect(response.statusCode).toBe(400);
    expect(errorCodeOf(response)).toBe('VALIDATION_ERROR');
    const cart = await testApp.app.inject({ method: 'GET', url: `/carts/${cartId}` });
    expect(cart.json<CartBody>().lines).toEqual([]);
  });

  it('rejects unknown products, over-stock quantities (including merged ones) and bad ids', async () => {
    const cartId = await createCartWith(testApp, [{ productId, quantity: 8 }]);

    const unknown = await addItem(cartId, { productId: new ObjectId().toHexString(), quantity: 1 });
    const merged = await addItem(cartId, { productId, quantity: 3 }); // 8 + 3 > stock 10
    const malformedCart = await testApp.app.inject({ method: 'GET', url: '/carts/not-an-id' });
    const missingCart = await testApp.app.inject({
      method: 'GET',
      url: `/carts/${new ObjectId().toHexString()}`,
    });

    expect([unknown.statusCode, errorCodeOf(unknown)]).toEqual([404, 'PRODUCT_NOT_FOUND']);
    expect([merged.statusCode, errorCodeOf(merged)]).toEqual([409, 'INSUFFICIENT_STOCK']);
    expect(malformedCart.statusCode).toBe(400);
    expect([missingCart.statusCode, errorCodeOf(missingCart)]).toEqual([404, 'CART_NOT_FOUND']);
  });

  it('sets an absolute quantity on PATCH and removes a line on DELETE', async () => {
    const cartId = await createCartWith(testApp, [{ productId, quantity: 5 }]);

    const patched = await testApp.app.inject({
      method: 'PATCH',
      url: `/carts/${cartId}/items/${productId}`,
      payload: { quantity: 2 },
    });
    const removed = await testApp.app.inject({
      method: 'DELETE',
      url: `/carts/${cartId}/items/${productId}`,
    });
    const removedAgain = await testApp.app.inject({
      method: 'DELETE',
      url: `/carts/${cartId}/items/${productId}`,
    });

    expect(patched.json<CartBody>().lines[0]?.quantity).toBe(2);
    expect(removed.json<CartBody>().lines).toEqual([]);
    expect([removedAgain.statusCode, errorCodeOf(removedAgain)]).toEqual([
      404,
      'CART_ITEM_NOT_FOUND',
    ]);
  });

  it('rejects any edit once the cart has been checked out', async () => {
    const cartId = await createCartWith(testApp, [{ productId, quantity: 1 }]);
    await checkout(testApp, cartId);

    const response = await addItem(cartId, { productId, quantity: 1 });

    expect([response.statusCode, errorCodeOf(response)]).toEqual([409, 'CART_NOT_OPEN']);
  });

  it('rejects checking out an empty cart', async () => {
    const response = await checkout(testApp, await createCartWith(testApp, []));
    expect([response.statusCode, errorCodeOf(response)]).toEqual([422, 'CART_EMPTY']);
  });

  it('shows live prices and flags lines that are no longer purchasable', async () => {
    const cartId = await createCartWith(testApp, [{ productId, quantity: 4 }]);
    await testApp.context.collections.products.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { unitPriceMinor: 3_000, stock: 2 } },
    );

    const cart = (
      await testApp.app.inject({ method: 'GET', url: `/carts/${cartId}` })
    ).json<CartBody>();

    expect(cart.lines[0]).toMatchObject({ unitPriceMinor: 3_000, isPurchasable: false });
    expect(cart.subtotalMinor).toBe(12_000);
    await testApp.context.collections.products.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { unitPriceMinor: 2_000, stock: 10 } },
    );
  });

  it('protects the customer from silent price changes and keeps orders as snapshots', async () => {
    const cartId = await createCartWith(testApp, [{ productId, quantity: 2 }]);
    await testApp.context.collections.products.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { unitPriceMinor: 2_500 } },
    );

    const stale = await checkout(testApp, cartId, { body: { expectedTotalMinor: 4_000 } });
    const accepted = await checkout(testApp, cartId, { body: { expectedTotalMinor: 5_000 } });
    await testApp.context.collections.products.updateOne(
      { _id: new ObjectId(productId) },
      { $set: { unitPriceMinor: 9_999 } },
    );
    const order = await testApp.app.inject({
      method: 'GET',
      url: `/orders/${accepted.json<{ id: string }>().id}`,
    });

    expect([stale.statusCode, errorCodeOf(stale)]).toEqual([409, 'PRICE_CHANGED']);
    expect(stale.json<{ error: { details: unknown } }>().error.details).toEqual({
      expectedTotalMinor: 4_000,
      actualTotalMinor: 5_000,
    });
    expect(order.json()).toMatchObject({ totalMinor: 5_000, items: [{ unitPriceMinor: 2_500 }] });
  });
});

describe('http surface', () => {
  let testApp: TestApp;
  beforeAll(async () => {
    testApp = await createTestApp();
    for (const sku of ['A-APPLE', 'B-BANANA', 'C-CHERRY']) {
      await insertProduct(testApp, { sku, unitPriceMinor: 100, stock: sku === 'B-BANANA' ? 0 : 5 });
    }
  });
  afterAll(() => testApp.close());

  it('pages products with a cursor without skipping or repeating rows', async () => {
    const pages: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await testApp.app.inject({
        method: 'GET',
        url: `/products?limit=2${cursor ? `&cursor=${cursor}` : ''}`,
      });
      const body: { data: { sku: string }[]; nextCursor: string | null } = response.json();
      pages.push(...body.data.map((product) => product.sku));
      cursor = body.nextCursor;
    } while (cursor);

    expect(pages).toEqual(['A-APPLE', 'B-BANANA', 'C-CHERRY']);
  });

  it('filters by name and stock, and rejects a garbage cursor', async () => {
    const inStock = await testApp.app.inject({ method: 'GET', url: '/products?inStock=true' });
    const search = await testApp.app.inject({ method: 'GET', url: '/products?q=banan' });
    const garbage = await testApp.app.inject({ method: 'GET', url: '/products?cursor=%%%' });

    expect(inStock.json<{ data: unknown[] }>().data).toHaveLength(2);
    expect(search.json<{ data: { sku: string }[] }>().data.map((p) => p.sku)).toEqual(['B-BANANA']);
    expect([garbage.statusCode, errorCodeOf(garbage)]).toEqual([400, 'INVALID_CURSOR']);
  });

  it('uses the standard error shape for unknown routes and malformed JSON', async () => {
    const unknown = await testApp.app.inject({ method: 'GET', url: '/nope' });
    const malformed = await testApp.app.inject({
      method: 'POST',
      url: '/carts/abc/items',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });

    expect([unknown.statusCode, errorCodeOf(unknown)]).toEqual([404, 'ROUTE_NOT_FOUND']);
    expect([malformed.statusCode, errorCodeOf(malformed)]).toEqual([400, 'BAD_REQUEST']);
  });

  it('accepts bodiless POSTs even when the client declares a JSON content type', async () => {
    const headers = { 'content-type': 'application/json', 'content-length': '0' };
    const cart = await testApp.app.inject({ method: 'POST', url: '/carts', headers });
    const checkoutWithoutBody = await testApp.app.inject({
      method: 'POST',
      url: `/carts/${cart.json<{ id: string }>().id}/checkout`,
      headers: { ...headers, 'idempotency-key': 'bodiless-key-1234' },
    });

    expect(cart.statusCode).toBe(201);
    expect([checkoutWithoutBody.statusCode, errorCodeOf(checkoutWithoutBody)]).toEqual([
      422,
      'CART_EMPTY',
    ]);
  });

  it('serves the OpenAPI document the web client is generated from', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/docs/json' });
    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.json<{ paths: object }>().paths)).toContain(
      '/carts/{cartId}/checkout',
    );
  });
});
