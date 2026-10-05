import { expect, test } from '@playwright/test';
import {
  applyCode,
  createReward,
  generateAllDueRewards,
  placeOrderViaApi,
  startCheckoutWith,
  useRewardElsewhere,
} from './helpers';

const SPEAKER = 'Portable Bluetooth Speaker'; // ₹7,999, so a 10% reward saves ₹799.90

test.describe('generating rewards on the Rewards page', () => {
  test('explains how many orders are needed when no reward is due', async ({ page, request }) => {
    await generateAllDueRewards(request);
    await page.goto('/rewards');

    await page.getByRole('button', { name: 'Generate reward' }).click();

    await expect(
      page.getByText(/No reward is due yet: .* the next reward unlocks at order \d+/),
    ).toBeVisible();
    await expect(page.getByText('1 order to go')).toBeVisible();
  });

  test('creates the reward for a reached milestone and lists it', async ({ page, request }) => {
    await generateAllDueRewards(request);
    await placeOrderViaApi(request); // n = 1 in e2e, so this order reaches the next milestone
    await page.goto('/rewards');

    await page.getByRole('button', { name: 'Generate reward' }).click();

    const created = page.getByText(/^Created SAVE-[A-Z0-9]{8}: 10% off/);
    await expect(created).toBeVisible();
    const code = (await created.innerText()).match(/SAVE-[A-Z0-9]{8}/)?.[0] ?? '';
    await expect(
      page.locator('main').getByRole('listitem').filter({ hasText: code }),
    ).toBeVisible();
  });
});

test.describe('rewards at checkout', () => {
  test('suggests the best reward with its exact saving and applies it in one tap', async ({
    page,
    request,
  }) => {
    await createReward(request);
    const [best] = (await (await request.get('/api/rewards')).json()) as { code: string }[];
    await startCheckoutWith(page, SPEAKER);

    await expect(page.getByText('Save ₹799.90 on this order')).toBeVisible();
    await page.getByRole('button', { name: `Apply reward ${best?.code}` }).click();

    await expect(page.getByText(`${best?.code} applied`)).toBeVisible();
    await expect(page.getByText("You're saving ₹799.90 on this order")).toBeVisible();
    await expect(page.getByText('₹7,199.10').first()).toBeVisible();
  });

  test('an unknown code is explained next to the field and nothing is ordered', async ({
    page,
  }) => {
    const checkoutRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/checkout') && request.method() === 'POST') {
        checkoutRequests.push(request.url());
      }
    });
    await startCheckoutWith(page, SPEAKER);

    await applyCode(page, 'SAVE-NOPE0000');

    await expect(page.getByText("This code doesn't exist. Check it and try again.")).toBeVisible();
    await expect(page.getByLabel('Reward code')).toHaveValue('SAVE-NOPE0000');
    await expect(page.getByText('₹7,999').last()).toBeVisible();
    expect(checkoutRequests).toEqual([]);
  });

  test('Remove takes the reward off and restores the total', async ({ page, request }) => {
    const code = await createReward(request);
    await startCheckoutWith(page, SPEAKER);
    await applyCode(page, code);
    await expect(page.getByText(`${code} applied`)).toBeVisible();

    await page.getByRole('button', { name: 'Remove', exact: true }).click();

    await expect(page.getByText(`${code} applied`)).toHaveCount(0);
    await expect(page.getByText(/You're saving/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Have a code?' })).toBeVisible();
  });

  test('a reward used by another order after applying is removed, with an explanation', async ({
    page,
    request,
  }) => {
    const code = await createReward(request);
    await startCheckoutWith(page, SPEAKER);
    await applyCode(page, code);
    await expect(page.getByText(`${code} applied`)).toBeVisible();

    await useRewardElsewhere(request, code);
    await page.getByRole('button', { name: 'Place order' }).click();

    await expect(page.getByText(`${code} was just used on another order`)).toBeVisible();
    await expect(page.getByText(`${code} applied`)).toHaveCount(0);
    await expect(page).toHaveURL(/\/checkout/);
  });

  test('"Use at checkout" on the Rewards page arrives with the reward applied', async ({
    page,
    request,
  }) => {
    const code = await createReward(request);
    await startCheckoutWith(page, SPEAKER);

    await page.goto('/rewards');
    await page
      .getByRole('listitem')
      .filter({ hasText: code })
      .getByRole('link', { name: 'Use at checkout' })
      .click();

    await expect(page).toHaveURL(/\/checkout\?reward=/);
    await expect(page.getByText(`${code} applied`)).toBeVisible();
  });

  test('a link with a code that cannot be used explains why', async ({ page }) => {
    await startCheckoutWith(page, SPEAKER);

    await page.goto('/checkout?reward=SAVE-NOPE0000');

    await expect(
      page.getByText("SAVE-NOPE0000 can't be used. This code doesn't exist."),
    ).toBeVisible();
  });
});
