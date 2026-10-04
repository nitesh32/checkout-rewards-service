import { expect, test, type Page } from '@playwright/test';

const MIN_TOUCH_TARGET_PX = 44;
const POINTER_SELECTOR = 'button, a[href], [role="switch"], summary, select';
const ALL_CONTROLS_SELECTOR = `${POINTER_SELECTOR}, input:not([type="hidden"])`;

interface ControlInfo {
  name: string;
  tag: string;
  cursor: string;
  pointerEvents: string;
  isDisabled: boolean;
  isInProse: boolean;
  width: number;
  height: number;
}

/** Reads cursor, hit area and state of every visible interactive element on the page. */
function readControls(page: Page): Promise<ControlInfo[]> {
  return page.evaluate(
    ([pointerSelector, allSelector]) =>
      // While a modal (the cart drawer) is open, everything behind it is inert by design.
      [
        ...(document.querySelector('[role="dialog"]') ?? document).querySelectorAll<HTMLElement>(
          allSelector as string,
        ),
      ]
        .filter((element) => element.checkVisibility())
        .map((element) => {
          // A control inside a <label> is clicked through the label, so its hit area is the label's.
          const rect = (element.closest('label') ?? element).getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            name: (
              element.getAttribute('aria-label') ??
              element.textContent ??
              element.getAttribute('placeholder') ??
              ''
            )
              .trim()
              .slice(0, 40),
            tag: element.tagName.toLowerCase(),
            cursor: style.cursor,
            pointerEvents: style.pointerEvents,
            isDisabled: element.matches(':disabled'),
            isInProse: element.closest('p') !== null && element.tagName === 'A',
            width: rect.width,
            height: rect.height,
            isPointerControl: element.matches(pointerSelector as string),
          };
        })
        .filter((control) => control.isPointerControl || control.tag === 'input'),
    [POINTER_SELECTOR, ALL_CONTROLS_SELECTOR],
  );
}

/** Makes sure the product is in the cart: clicks Add, unless its card already shows the quantity stepper. */
async function addProductToCart(page: Page, productName: string): Promise<void> {
  await page.goto('/products');
  const card = page.getByRole('listitem').filter({ hasText: productName });
  const add = card.getByRole('button', { name: /Add to cart/ });
  if (await add.count()) await add.click();
  await expect(card.getByRole('group', { name: /Quantity of/ })).toBeVisible();
}

/** The pages and states a shopper sees; each callback leaves the page showing that screen. */
const SCREENS: { name: string; show: (page: Page) => Promise<void> }[] = [
  {
    name: 'shop',
    show: (page) =>
      page.goto('/products').then(() => page.getByRole('heading', { name: 'Shop all' }).waitFor()),
  },
  {
    name: 'rewards',
    show: (page) =>
      page
        .goto('/rewards')
        .then(() => page.getByRole('heading', { name: 'Margin Rewards' }).waitFor()),
  },
  {
    name: 'shop with add-to-cart toast',
    show: async (page) => {
      await addProductToCart(page, 'Mirrorless Camera');
      await page.getByRole('button', { name: 'View cart' }).waitFor();
    },
  },
  {
    name: 'cart drawer',
    show: async (page) => {
      await addProductToCart(page, 'Mirrorless Camera');
      await page.getByRole('button', { name: 'Open cart' }).click();
      await page.getByRole('heading', { name: 'Your cart' }).waitFor();
    },
  },
  {
    name: 'checkout',
    show: async (page) => {
      await addProductToCart(page, 'Mirrorless Camera');
      await page.goto('/checkout');
      await page.getByRole('heading', { name: 'Checkout' }).waitFor();
    },
  },
];

test.describe('mouse', () => {
  for (const screen of SCREENS) {
    test(`${screen.name}: enabled controls show a pointer, disabled ones not-allowed`, async ({
      page,
    }) => {
      await screen.show(page);
      const controls = await readControls(page);
      expect(controls.length).toBeGreaterThan(0);

      for (const control of controls) {
        if (control.tag === 'input') continue; // text fields keep the text cursor
        // On wide screens the checkout summary heading is static by design.
        if (control.tag === 'summary') continue;
        const expectedCursor = control.isDisabled ? 'not-allowed' : 'pointer';
        expect(control.cursor, `${control.tag} "${control.name}"`).toBe(expectedCursor);
        expect(
          control.pointerEvents,
          `${control.tag} "${control.name}" must stay hoverable`,
        ).not.toBe('none');
      }
    });
  }

  test('a capped quantity stepper is disabled but still explains why', async ({ page }) => {
    await addProductToCart(page, 'Mirrorless Camera'); // 3 in stock
    await page.getByRole('button', { name: 'Open cart' }).click();
    const increase = page.getByRole('button', { name: /Increase quantity/ });
    for (let unit = 1; unit < 3; unit += 1) await increase.click();

    await expect(increase).toBeDisabled();
    await expect(increase).toHaveAttribute('title', 'Only 3 available');
    expect(await increase.evaluate((element) => getComputedStyle(element).pointerEvents)).not.toBe(
      'none',
    );
  });

  test('keyboard focus is visible on every stop of the shop page', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('heading', { name: 'Shop all' }).waitFor();

    for (let stop = 0; stop < 30; stop += 1) {
      await page.keyboard.press('Tab');
      const indicator = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return 'body';
        const style = getComputedStyle(element);
        const hasRing =
          style.boxShadow !== 'none' ||
          (style.outlineStyle !== 'none' && style.outlineWidth !== '0px');
        return hasRing
          ? 'ring'
          : `none on <${element.tagName.toLowerCase()}> ${element.textContent?.trim().slice(0, 30) ?? ''}`;
      });
      expect(indicator, `tab stop ${stop}`).toMatch(/^(ring|body)$/);
    }
  });

  test('browsing the whole flow logs no console errors', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
    page.on('pageerror', (error) => problems.push(error.message));

    for (const screen of SCREENS) await screen.show(page);
    expect(problems).toEqual([]);
  });
});

for (const viewport of [
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test.describe(`touch ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: true,
      isMobile: true,
    });

    test('add to cart is always visible and quick add never replaces it', async ({ page }) => {
      await page.goto('/products');
      await page.getByRole('heading', { name: 'Shop all' }).waitFor();
      expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);

      await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(6);
      await expect(page.getByRole('button', { name: 'Quick add' })).toHaveCount(0);
    });

    for (const screen of SCREENS) {
      test(`${screen.name}: every control has a ${MIN_TOUCH_TARGET_PX}px touch target`, async ({
        page,
      }) => {
        await screen.show(page);
        const tooSmall = (await readControls(page))
          .filter((control) => !control.isInProse)
          .filter(
            (control) =>
              control.height < MIN_TOUCH_TARGET_PX ||
              (control.tag !== 'a' && control.width < MIN_TOUCH_TARGET_PX),
          )
          .map(
            (control) =>
              `${control.tag} "${control.name}" ${Math.round(control.width)}x${Math.round(control.height)}`,
          );
        expect(tooSmall).toEqual([]);
      });
    }

    test('no horizontal overflow', async ({ page }) => {
      for (const screen of SCREENS) {
        await screen.show(page);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, screen.name).toBeLessThanOrEqual(0);
      }
    });
  });
}
