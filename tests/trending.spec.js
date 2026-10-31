// @ts-check
import { test, expect } from '@playwright/test';
import searchIphone from './fixtures/search-iphone.json' with { type: 'json' };

test.describe('Trending page', () => {
  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
  });

  test('user can see the trending table with at least one row', async ({ page }) => {
    await page.goto('/trending');

    await expect(page.getByRole('heading', { name: 'Trending', exact: true })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    // One header row plus at least one product row.
    await expect(page.getByRole('row')).not.toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Compare', exact: true }).first()).toBeVisible();
  });

  test('user can open the compare page from a trending row', async ({ page }) => {
    // Never call SerpApi from a test. Return the saved response instead.
    await page.route('**/api/search*', (route) => route.fulfill({ json: searchIphone }));

    await page.goto('/trending');
    await page.getByRole('link', { name: 'Compare', exact: true }).first().click();

    await expect(page).toHaveURL(/\/compare\?q=/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
