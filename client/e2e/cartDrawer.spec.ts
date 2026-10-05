import { expect, test, type Page } from '@playwright/test';

const PRODUCT = 'Portable Bluetooth Speaker';

async function addAndOpenCart(page: Page): Promise<void> {
  await page.goto('/products');
  const card = page.getByRole('listitem').filter({ hasText: PRODUCT });
  await card.getByRole('button', { name: /Add to cart/ }).click();
  await expect(card.getByRole('group', { name: /Quantity of/ })).toBeVisible();
  await page.getByRole('button', { name: 'Open cart' }).click();
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
}

test.describe('cart drawer', () => {
  test('minus on the last unit removes the line instead of being disabled', async ({ page }) => {
    await addAndOpenCart(page);
    const drawer = page.getByRole('dialog');

    const minus = drawer.getByRole('button', { name: `Remove ${PRODUCT} from cart` });
    await expect(minus).toBeEnabled();
    await minus.click();

    await expect(drawer.getByText('Your cart is empty')).toBeVisible();
  });

  test('Remove clears every unit of the product at once', async ({ page }) => {
    await addAndOpenCart(page);
    const drawer = page.getByRole('dialog');
    const increase = drawer.getByRole('button', { name: `Increase quantity of ${PRODUCT}` });
    await increase.click();
    await increase.click();
    await expect(drawer.getByRole('group', { name: `Quantity of ${PRODUCT}` })).toContainText('3');

    await drawer.getByRole('button', { name: `Remove all ${PRODUCT} from cart` }).click();

    await expect(drawer.getByText('Your cart is empty')).toBeVisible();
  });
});
