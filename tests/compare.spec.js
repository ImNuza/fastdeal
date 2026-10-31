// @ts-check
import { test, expect } from '@playwright/test';
import searchIphone from './fixtures/search-iphone.json' with { type: 'json' };

// Days of tracked prices, oldest first, as GET /api/price-history returns them.
const THREE_DAYS = [
  { day: '2026-10-29', price: 829 },
  { day: '2026-10-30', price: 815 },
  { day: '2026-10-31', price: 806 }
];

test.describe('Compare page price history', () => {
  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  // Never call SerpApi from a test. Return the saved search instead.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
    await page.route('**/api/search*', (route) => route.fulfill({ json: searchIphone }));
    await page.route('**/api/searched-with*', (route) => route.fulfill({ json: [] }));
  });

  test('user sees one line instead of a chart when a product has no price history yet', async ({ page }) => {
    await page.route('**/api/price-history*', (route) => route.fulfill({ json: [] }));
    await page.goto('/compare?q=iphone%2016');

    const history = page.getByRole('region', { name: 'Price history' });
    await expect(history).toBeVisible();
    await expect(history.getByText('Price history is still being tracked for this product.', { exact: false })).toBeVisible();
    await expect(history.getByText('One bar for each day', { exact: false })).toHaveCount(0);
  });

  test('user sees the price history and verdict above the filters and listings', async ({ page }) => {
    await page.route('**/api/price-history*', (route) => route.fulfill({ json: THREE_DAYS }));
    await page.goto('/compare?q=iphone%2016');

    const history = page.getByRole('region', { name: 'Price history' });
    await expect(history.getByText('One bar for each day with a tracked price', { exact: false })).toBeVisible();
    await expect(history.getByText('14-day low S$806.00', { exact: false })).toBeVisible();

    // The section sits above the filters: its top edge is higher on the page.
    const historyBox = await history.boundingBox();
    const filterBox = await page.getByLabel('Min price').boundingBox();
    expect(historyBox && filterBox && historyBox.y < filterBox.y).toBe(true);
  });
});
