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

  // Scoped to <main>: toasts are list items too, and "… added to cart" names the product.
  const card = (page: import('@playwright/test').Page) =>
    page.locator('main').getByRole('listitem').filter({ hasText: PRODUCT });

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

  test('after adding, a compact stepper sits in the Add button slot without resizing the card', async ({
    page,
  }) => {
    const add = card(page).getByRole('button', { name: /Add to cart/ });
    const slot = await boxOf(add);
    const cardBefore = await boxOf(card(page));

    await add.click();
    const stepper = card(page).getByRole('group', { name: /Quantity of/ });
    await expect(stepper).toContainText('1');
    await expect(card(page).getByText('In cart')).toBeVisible();

    const box = await boxOf(stepper);
    expect(box.y).toBeGreaterThanOrEqual(slot.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(slot.y + slot.height + 1);
    expect(Math.abs((await boxOf(card(page))).height - cardBefore.height)).toBeLessThanOrEqual(1);

    // Minus and plus sit next to the quantity, not at the far edges of the card.
    const minus = await boxOf(stepper.getByRole('button').first());
    const plus = await boxOf(stepper.getByRole('button').last());
    expect(plus.x - (minus.x + minus.width)).toBeLessThan(60);
  });

  test('minus on the last unit removes the product and brings back Add to cart', async ({
    page,
  }) => {
    await card(page)
      .getByRole('button', { name: /Add to cart/ })
      .click();

    await card(page)
      .getByRole('button', { name: `Remove ${PRODUCT} from cart` })
      .click();

    await expect(card(page).getByRole('group', { name: /Quantity of/ })).toHaveCount(0);
    await expect(card(page).getByRole('button', { name: /Add to cart/ })).toBeVisible();
  });

  test('plus and minus change the quantity on the card', async ({ page }) => {
    await card(page)
      .getByRole('button', { name: /Add to cart/ })
      .click();
    const stepper = card(page).getByRole('group', { name: /Quantity of/ });

    await stepper.getByRole('button', { name: `Increase quantity of ${PRODUCT}` }).click();
    await expect(stepper).toContainText('2');
    await stepper.getByRole('button', { name: `Decrease quantity of ${PRODUCT}` }).click();
    await expect(stepper).toContainText('1');
  });
});

test.describe('product card on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the stepper fits inside the narrow card', async ({ page }) => {
    await page.goto('/products');
    const card = page.locator('main').getByRole('listitem').filter({ hasText: PRODUCT });
    await card.getByRole('button', { name: /Add to cart/ }).click();
    const stepper = card.getByRole('group', { name: /Quantity of/ });
    await expect(stepper).toBeVisible();

    const cardBox = await boxOf(card);
    const stepperBox = await boxOf(stepper);
    expect(stepperBox.x).toBeGreaterThanOrEqual(cardBox.x);
    expect(stepperBox.x + stepperBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
  });
});
