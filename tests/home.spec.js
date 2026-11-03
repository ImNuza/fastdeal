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
    // The week carousel shows one card at a time as a link. The cards beside it are hidden from screen readers.
    const week = page.getByRole('region', { name: 'Trending this week' });
    await expect(week.getByRole('link').first()).toBeVisible();
  });

  test('user sees the product initials when a trending product has no photo', async ({ page }) => {
    // One trending product with no image, as the seeded searches used to have.
    await page.route('**/api/trending', (route) => route.fulfill({
      json: { today: [], week: [{ _id: 'sony wh-1000xm5', query: 'Sony WH-1000XM5', image: '', count: 3 }] }
    }));
    await page.goto('/');

    const week = page.getByRole('region', { name: 'Trending this week' });
    const card = week.getByRole('link', { name: /Sony WH-1000XM5/ });
    await expect(card).toBeVisible();
    await expect(card.getByText('SW', { exact: true })).toBeVisible();
    await expect(card.getByRole('img')).toHaveCount(0);
  });
});
