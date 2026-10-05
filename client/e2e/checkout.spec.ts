import { expect, test } from '@playwright/test';
import { applyCode, createReward } from './helpers';

test('add to cart, check out with a coupon, and see the order receipt', async ({
  page,
  request,
}) => {
  const couponCode = await createReward(request);

  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'Portable Bluetooth Speaker' })).toBeVisible();

  await page
    .getByRole('listitem')
    .filter({ hasText: 'Portable Bluetooth Speaker' })
    .getByRole('button', { name: /Add to cart/ })
    .click();
  await expect(page.getByRole('button', { name: 'Open cart' })).toContainText('1');

  await page.getByRole('button', { name: 'Open cart' }).click();
  await page.getByRole('link', { name: 'Checkout' }).click();

  await applyCode(page, couponCode.toLowerCase());

  // The discount is confirmed before ordering, as in production checkouts.
  await expect(page.getByText(`${couponCode} applied`)).toBeVisible();
  await expect(page.getByText('You save ₹799.90')).toBeVisible();
  await expect(page.getByText('₹7,199.10').first()).toBeVisible(); // ₹7,999 less 10%

  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page).toHaveURL(/\/orders\/[a-f0-9]{24}$/);
  await expect(page.getByRole('heading', { name: /Thank you, order MRG-\d{5}/ })).toBeVisible();
  await expect(page).toHaveTitle('Order confirmed · Margin');
  await expect(page.getByText(`You saved ₹799.90 with ${couponCode}`)).toBeVisible();
  await expect(page.getByText(`Reward ${couponCode} (10% off)`)).toBeVisible();
});

test('retrying after a lost response reuses the idempotency key and shows the replayed order', async ({
  page,
  request,
}) => {
  await page.goto('/products');
  await page
    .getByRole('listitem')
    .filter({ hasText: 'True Wireless Earbuds' })
    .getByRole('button', { name: /Add to cart|Quick add/ })
    .click();
  await expect(page.getByRole('button', { name: 'Open cart' })).toContainText('1');
  await page.goto('/checkout');

  // The server places the order, but the response never reaches the browser.
  const keysSent: (string | undefined)[] = [];
  await page.route('**/api/carts/*/checkout', async (route) => {
    keysSent.push(route.request().headers()['idempotency-key']);
    if (keysSent.length > 1) return route.continue();
    await route.fetch();
    return route.abort('connectionreset');
  });

  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByText('You appear to be offline')).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();

  await expect(page).toHaveURL(/\/orders\/[a-f0-9]{24}$/);
  await expect(page.getByText('Replayed', { exact: true })).toBeVisible();
  expect(keysSent[0]).toBeDefined();
  expect(keysSent[1]).toBe(keysSent[0]);

  const orders = (await (await request.get('/api/admin/orders?limit=100')).json()) as {
    data: { items: { sku: string }[] }[];
  };
  const mugOrders = orders.data.filter((order) =>
    order.items.some((item) => item.sku === 'EARBUDS-TWS-BLK'),
  );
  expect(mugOrders).toHaveLength(1);
});
