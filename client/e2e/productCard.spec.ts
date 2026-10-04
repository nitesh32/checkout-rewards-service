import { expect, test, type Locator } from '@playwright/test';

const PRODUCT = 'Portable Bluetooth Speaker';

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element has no bounding box');
  return box;
}

test.describe('product card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('main h2')).toHaveCount(6);
  });

  const card = (page: import('@playwright/test').Page) =>
    page.getByRole('listitem').filter({ hasText: PRODUCT });

  test('the cart control is its own row below the photo, not an overlay on it', async ({
    page,
  }) => {
    const photo = await boxOf(card(page).getByRole('button', { name: /Quick view/ }));
    const add = await boxOf(card(page).getByRole('button', { name: /Add to cart/ }));
    const cardBox = await boxOf(card(page));

    expect(add.y).toBeGreaterThanOrEqual(photo.y + photo.height);
    expect(add.width).toBeGreaterThan(cardBox.width * 0.85);
  });

  test('the photo and the name react to hover together, and the Add button does not move the photo', async ({
    page,
  }) => {
    const photo = card(page).locator('img');
    const name = card(page).getByRole('heading').getByRole('button');
    const underline = () =>
      name.evaluate((element) => getComputedStyle(element).textDecorationLine);
    // Tailwind v4 zooms with the individual `scale` property, not `transform`.
    const photoScale = () => photo.evaluate((element) => getComputedStyle(element).scale);

    await card(page)
      .getByRole('button', { name: /Quick view/ })
      .hover();
    await expect.poll(underline).toBe('underline');
    await expect.poll(photoScale).not.toBe('none');

    await card(page)
      .getByRole('button', { name: /Add to cart/ })
      .hover();
    await expect.poll(underline).toBe('none');
    await expect.poll(photoScale).toBe('none');
  });

  test('the whole card highlights on hover', async ({ page }) => {
    const borderColour = () =>
      card(page).evaluate((element) => getComputedStyle(element).borderTopColor);
    const resting = await borderColour();

    await card(page).hover();

    await expect.poll(borderColour).not.toBe(resting);
  });

  test('the added-to-cart toast shows its thumbnail without covering the text', async ({
    page,
  }) => {
    await card(page)
      .getByRole('button', { name: /Add to cart/ })
      .click();
    await expect(page.getByRole('button', { name: 'View cart' })).toBeVisible();

    const boxes = await page.evaluate(() => {
      const icon = document
        .querySelector('[data-sonner-toast] [data-icon]')
        ?.getBoundingClientRect();
      const text = document
        .querySelector('[data-sonner-toast] [data-content]')
        ?.getBoundingClientRect();
      return { iconRight: icon?.right ?? Number.NaN, textLeft: text?.left ?? Number.NaN };
    });
    expect(boxes.textLeft).toBeGreaterThanOrEqual(boxes.iconRight);
  });

  test('the quantity stepper takes exactly the place of the Add button', async ({ page }) => {
    const add = card(page).getByRole('button', { name: /Add to cart/ });
    const before = await boxOf(add);

    await add.click();
    const stepper = card(page).getByRole('group', { name: /Quantity of/ });
    await expect(stepper).toBeVisible();
    const after = await boxOf(stepper);

    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
    await expect(stepper).toContainText('1 in cart');
  });
});
