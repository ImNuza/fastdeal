// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Error pages', () => {
  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
  });

  test('user who opens an unknown page sees Page not found and can go back home', async ({ page }) => {
    await page.goto('/no-such-page');

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to Home' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('user sees the server error page with Try again when a page fails to load', async ({ page }) => {
    // The Trending page loads /api/trending. A server error replaces the page with the error page.
    await page.route('**/api/trending', (route) => route.fulfill({ status: 500, json: { error: 'test' } }));

    await page.goto('/trending');

    await expect(page.getByRole('heading', { name: 'Server error' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trending', exact: true })).toHaveCount(0);
  });
});
