import { expect, test } from '@playwright/test';

test.describe('search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('main h2')).toHaveCount(6);
  });

  test('filters instantly without asking the server, and the URL follows after a pause', async ({
    page,
  }) => {
    const catalogueRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/products')) catalogueRequests.push(request.url());
    });

    await page
      .getByRole('searchbox', { name: 'Search products' })
      .pressSequentially('bluetooth speak', { delay: 40 });

    await expect(page.locator('main h2')).toHaveText(['Portable Bluetooth Speaker']);
    await expect(page).toHaveURL(/q=bluetooth(\+|%20)speak/);
    expect(catalogueRequests).toEqual([]);
  });

  test('matches on words in any order, and on the category', async ({ page }) => {
    const search = page.getByRole('searchbox', { name: 'Search products' });

    await search.fill('speaker portable');
    await expect(page.locator('main h2')).toHaveText(['Portable Bluetooth Speaker']);

    await search.fill('audio');
    await expect(page.locator('main h2')).toHaveCount(3);
  });

  test('"Clear filters" empties the search box as well as the list', async ({ page }) => {
    const search = page.getByRole('searchbox', { name: 'Search products' });
    await search.fill('zzzz');
    await expect(page.getByText('No products match "zzzz"')).toBeVisible();

    await page.getByRole('button', { name: 'Clear filters' }).click();

    await expect(search).toHaveValue('');
    await expect(page.locator('main h2')).toHaveCount(6);
    await expect(page).not.toHaveURL(/q=/);
  });

  test('keeps a search that is already in the URL', async ({ page }) => {
    await page.goto('/products?q=camera');
    await expect(page.getByRole('searchbox', { name: 'Search products' })).toHaveValue('camera');
    await expect(page.locator('main h2')).toHaveText(['Mirrorless Camera Body (Limited Edition)']);
  });
});
