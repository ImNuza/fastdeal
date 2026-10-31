// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Home page trending', () => {
  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
  });

  test('user can see items under Trending Today and Trending This Week', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Trending Today' })).toBeVisible();
    await expect(page.getByLabel('Trending today').getByRole('link').first()).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Trending This Week' })).toBeVisible();
    // Each week card is a link with the product name as a level 5 heading.
    const weekCards = page.getByRole('link').filter({ has: page.getByRole('heading', { level: 5 }) });
    await expect(weekCards.first()).toBeVisible();
  });
});
