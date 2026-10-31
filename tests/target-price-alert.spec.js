
 // @ts-check
import { test, expect } from '@playwright/test';

// Open the wishlist and wait until the saved products and live prices are loaded. Typing before
// that can be lost, because the list can load again and the input gets the saved value back.
/** @param {import('@playwright/test').Page} page */
async function openWishlist(page) {
  const loaded = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/wishlist' && response.request().method() === 'GET');
  await page.goto('/wishlist');
  await loaded;
  await page.waitForLoadState('networkidle');
}

test.describe('Wishlist target price alerts', () => {
  // Run these tests one after another because they modify the same demo wishlist.
  test.describe.configure({ mode: 'serial' });

  // Skip the welcome popup and prevent actual email notifications.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));

    // Return an empty price search result instead of calling SerpApi.
    await page.route('**/api/search*', (route) => route.fulfill({
      json: { listings: [] }
    }));

    // A saved product gets its live price from its product page. Return nothing, so the price search runs.
    await page.route('**/api/product/*', (route) => route.fulfill({
      status: 404,
      json: { error: 'e2e-test' }
    }));

    // Do not send real target price alert emails during testing.
    await page.route('**/api/wishlist/*/check-target', (route) => route.fulfill({
      json: { checked: false, reason: 'e2e-test' }
    }));
  });

  test('user can save a target price @admin', async ({ page }) => {
    await openWishlist(page);

    // Select the first product with a target price input.
    const input = page.getByLabel(/^Target price for /).first();
    await expect(input).toBeVisible();

    const label = await input.getAttribute('aria-label');
    if (!label) throw new Error('Target price input has no label');

    const original = await input.inputValue();
    const newTarget = Number(original) === 0.01 ? '0.02' : '0.01';

    try {
      // Change the target price and wait for MongoDB to save it.
      const saveResponse = page.waitForResponse((response) =>
        response.url().includes('/api/wishlist/') &&
        !response.url().includes('/check-target') &&
        response.request().method() === 'PATCH' &&
        response.status() === 200
      );

      await input.fill(newTarget);
      await input.press('Tab');

      const response = await saveResponse;
      const data = await response.json();

      expect(Number(data.targetPrice)).toBe(Number(newTarget));
      await expect(input).toHaveValue(newTarget);

      // Refresh the Wishlist and check the saved target price.
      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page.getByLabel(label, { exact: true })).toHaveValue(newTarget);
    } finally {
      // Restore the original target price so the demo wishlist is unchanged.
      await openWishlist(page);

      const restoreInput = page.getByLabel(label, { exact: true });
      await expect(restoreInput).toBeVisible();

      if (Number(await restoreInput.inputValue()) !== Number(original || '0')) {
        const restoreResponse = page.waitForResponse((response) =>
          response.url().includes('/api/wishlist/') &&
          !response.url().includes('/check-target') &&
          response.request().method() === 'PATCH' &&
          response.status() === 200
        );

        await restoreInput.fill(original || '0');
        await restoreInput.press('Tab');
        await restoreResponse;
      }
    }
  });

  test('user can update a target price and keep it after reload @admin', async ({ page }) => {
    await openWishlist(page);

    const input = page.getByLabel(/^Target price for /).first();
    await expect(input).toBeVisible();

    const label = await input.getAttribute('aria-label');
    if (!label) throw new Error('Target price input has no label');

    const original = await input.inputValue();
    const firstTarget = '0.03';
    const secondTarget = '0.04';

    try {
      // Save the first target price.
      if (Number(original) !== Number(firstTarget)) {
        const firstResponse = page.waitForResponse((response) =>
          response.url().includes('/api/wishlist/') &&
          !response.url().includes('/check-target') &&
          response.request().method() === 'PATCH' &&
          response.status() === 200
        );

        await input.fill(firstTarget);
        await input.press('Tab');

        const response = await firstResponse;
        expect(Number((await response.json()).targetPrice)).toBe(Number(firstTarget));
      }

      // Change the target price again.
      const secondResponse = page.waitForResponse((response) =>
        response.url().includes('/api/wishlist/') &&
        !response.url().includes('/check-target') &&
        response.request().method() === 'PATCH' &&
        response.status() === 200
      );

      await input.fill(secondTarget);
      await input.press('Tab');

      const response = await secondResponse;
      expect(Number((await response.json()).targetPrice)).toBe(Number(secondTarget));

      // Refresh the page and verify the most recent target was saved.
      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page.getByLabel(label, { exact: true })).toHaveValue(secondTarget);
    } finally {
      // Restore the original target price.
      await openWishlist(page);

      const restoreInput = page.getByLabel(label, { exact: true });
      await expect(restoreInput).toBeVisible();

      if (Number(await restoreInput.inputValue()) !== Number(original || '0')) {
        const restoreResponse = page.waitForResponse((response) =>
          response.url().includes('/api/wishlist/') &&
          !response.url().includes('/check-target') &&
          response.request().method() === 'PATCH' &&
          response.status() === 200
        );

        await restoreInput.fill(original || '0');
        await restoreInput.press('Tab');
        await restoreResponse;
      }
    }
  });
});
