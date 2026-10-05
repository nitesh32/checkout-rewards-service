import { expect, type APIRequestContext, type Page } from '@playwright/test';

interface Id {
  id: string;
}

interface PlacedOrder {
  unlockedReward: { code: string } | null;
}

/** Places one order (one unit of the first product) through the API. */
export async function placeOrderViaApi(request: APIRequestContext): Promise<PlacedOrder> {
  const products = (await (await request.get('/api/products?limit=1')).json()) as { data: Id[] };
  const cart = (await (await request.post('/api/carts')).json()) as Id;
  await request.post(`/api/carts/${cart.id}/items`, {
    data: { productId: products.data[0]?.id, quantity: 1 },
  });
  const response = await request.post(`/api/carts/${cart.id}/checkout`, {
    headers: { 'idempotency-key': crypto.randomUUID() },
    data: {},
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as PlacedOrder;
}

/** Places orders until one unlocks a reward (the e2e backend uses n = 1), and returns its code. */
export async function createReward(request: APIRequestContext): Promise<string> {
  for (;;) {
    const { unlockedReward } = await placeOrderViaApi(request);
    if (unlockedReward) return unlockedReward.code;
  }
}

/** Redeems a reward through the API, as another shopper would. */
export async function useRewardElsewhere(request: APIRequestContext, code: string): Promise<void> {
  const products = (await (await request.get('/api/products?limit=1')).json()) as { data: Id[] };
  const cart = (await (await request.post('/api/carts')).json()) as Id;
  await request.post(`/api/carts/${cart.id}/items`, {
    data: { productId: products.data[0]?.id, quantity: 1 },
  });
  const response = await request.post(`/api/carts/${cart.id}/checkout`, {
    headers: { 'idempotency-key': crypto.randomUUID() },
    data: { couponCode: code },
  });
  expect(response.status()).toBe(201);
}

/** Adds one product to the cart from the shop and opens checkout. */
export async function startCheckoutWith(page: Page, productName: string): Promise<void> {
  await page.goto('/products');
  const card = page.getByRole('listitem').filter({ hasText: productName });
  await card.getByRole('button', { name: /Add to cart/ }).click();
  await expect(card.getByRole('group', { name: /Quantity of/ })).toBeVisible();
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
}

/** Opens "Have a code?", enters the code and applies it. */
export async function applyCode(page: Page, code: string): Promise<void> {
  await page.getByRole('button', { name: 'Have a code?' }).click();
  await page.getByLabel('Reward code').fill(code);
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
}
