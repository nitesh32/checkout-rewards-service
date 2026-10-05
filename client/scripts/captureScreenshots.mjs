// Usage: node scripts/captureScreenshots.mjs <outDir> [baseUrl]
// Captures the shop, the cart drawer and checkout at desktop and phone widths, in light and dark.
//
// The phone is emulated with touch (no hover, coarse pointer), like a real one. Playwright drops that
// emulation after a full-page capture or a viewport resize, so each shot gets a fresh context whose
// viewport is already tall enough, and the phone never uses fullPage.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const outDir = process.argv[2];
const baseUrl = process.argv[3] ?? 'http://localhost:5173';
if (!outDir) throw new Error('Usage: captureScreenshots.mjs <outDir> [baseUrl]');
mkdirSync(outDir, { recursive: true });

const THEMES = ['light', 'dark'];
const PHONE_WIDTH = 390;

const DEVICES = {
  1440: () => ({ options: { viewport: { width: 1440, height: 900 } }, isPhone: false }),
  [PHONE_WIDTH]: () => ({ options: { hasTouch: true, isMobile: true }, isPhone: true }),
};

// How tall the phone viewport must be to show each screen in full.
const PHONE_HEIGHTS = { shop: 2400, cart: 844, checkout: 1300 };

async function addFirstProduct(page) {
  await page.goto(`${baseUrl}/products`);
  await page.getByRole('heading', { name: 'Shop all' }).waitFor();
  await page
    .getByRole('button', { name: /Add to cart|Quick add/ })
    .first()
    .click({ force: true });
  await page.getByRole('button', { name: 'Open cart' }).filter({ hasText: '1' }).waitFor();
}

const SCREENS = {
  shop: async (page) => {
    await page.goto(`${baseUrl}/products`);
    await page.getByRole('heading', { name: 'Shop all' }).waitFor();
  },
  cart: async (page) => {
    await addFirstProduct(page);
    await page.getByRole('button', { name: 'Open cart' }).click();
    await page.getByRole('heading', { name: 'Your cart' }).waitFor();
  },
  checkout: async (page) => {
    await addFirstProduct(page);
    await page.goto(`${baseUrl}/checkout`);
    await page.getByRole('heading', { name: 'Checkout' }).waitFor();
  },
};

const browser = await chromium.launch();
for (const [width, device] of Object.entries(DEVICES)) {
  for (const theme of THEMES) {
    for (const [name, show] of Object.entries(SCREENS)) {
      const { options, isPhone } = device();
      const viewport = isPhone
        ? { width: PHONE_WIDTH, height: PHONE_HEIGHTS[name] }
        : options.viewport;
      const context = await browser.newContext({ ...options, viewport, colorScheme: theme });
      const page = await context.newPage();
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);

      await show(page);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${outDir}/${name}-${width}-${theme}.png`,
        fullPage: !isPhone && name !== 'cart',
      });
      await context.close();
    }
  }
}
await browser.close();
