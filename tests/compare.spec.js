// @ts-check
import { test, expect } from '@playwright/test';
import searchIphone from './fixtures/search-iphone.json' with { type: 'json' };
import worthIt from './fixtures/worth-it.json' with { type: 'json' };

// The saved search has 10 listings from 5 stores. The cheapest is Apple iPhone 16 at
// Swiftronics USA for S$806. A page shows 8 listings.

// 30 days of prices for the price history chart, ending at the cheapest listing's price
function withHistory(search) {
  const points = [];
  for (let i = 0; i < 30; i++) {
    const day = new Date(Date.UTC(2026, 9, 6 + i)).toISOString().slice(0, 10);
    points.push({ day: day, price: 806 + (29 - i) * 5 });
  }
  const listings = search.listings.map((row, i) => (i === 0 ? { ...row, history: { points: points } } : row));
  return { ...search, listings: listings };
}

test.describe('Compare page', () => {
  test.beforeEach(async ({ page }) => {
    // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
  });

  test('user sees the cheapest listing marked and the listings split into pages', async ({ page }) => {
    // Never call SerpApi from a test. Return the saved response instead.
    await page.route('**/api/search*', (route) => route.fulfill({ json: searchIphone }));
    await page.goto('/compare?q=iphone 16');

    const cheapest = page.getByRole('article').filter({ hasText: 'Cheapest' });
    await expect(cheapest).toHaveCount(1);
    await expect(cheapest).toContainText('S$806');
    await expect(cheapest).toContainText('Swiftronics USA');

    await expect(page.getByText('Showing 1 to 8 of 10 listings')).toBeVisible();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('Showing 9 to 10 of 10 listings')).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(2);
  });

  test('user can filter the listings by store', async ({ page }) => {
    await page.route('**/api/search*', (route) => route.fulfill({ json: searchIphone }));
    await page.goto('/compare?q=iphone 16');

    await page.getByLabel('Store').selectOption('Apple');

    const cards = page.getByRole('article');
    const count = searchIphone.listings.filter((row) => row.store === 'Apple').length;
    await expect(cards).toHaveCount(count);
    for (const card of await cards.all()) {
      // The store line reads exactly "Apple". The product name "Apple iPhone 16" does not match.
      await expect(card.getByText('Apple', { exact: true })).toBeVisible();
    }
  });

  test('user can sort the listings by highest rating', async ({ page }) => {
    await page.route('**/api/search*', (route) => route.fulfill({ json: searchIphone }));
    await page.goto('/compare?q=iphone 16');

    await page.getByLabel('Sort').selectOption('rating');

    const best = Math.max(...searchIphone.listings.map((row) => row.rating));
    await expect(page.getByRole('article').first().getByLabel('Rating ' + best.toFixed(1) + ' out of 5')).toBeVisible();
  });

  test('user sees a message when no listing matches the price filters', async ({ page }) => {
    await page.route('**/api/search*', (route) => route.fulfill({ json: searchIphone }));
    await page.goto('/compare?q=iphone 16');

    await page.getByLabel('Min price').fill('5000');

    await expect(page.getByText('No listings match these filters.')).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(0);
  });

  test('user sees the price history chart only when the search has a history', async ({ page }) => {
    await page.route('**/api/search*', (route) => route.fulfill({ json: searchIphone }));
    await page.goto('/compare?q=iphone 16');
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Price history' })).toHaveCount(0);

    await page.unroute('**/api/search*');
    await page.route('**/api/search*', (route) => route.fulfill({ json: withHistory(searchIphone) }));
    await page.goto('/compare?q=iphone 16 pro');

    await expect(page.getByRole('heading', { name: 'Price history' })).toBeAttached();
    const range = page.getByRole('group', { name: 'Date range' });
    await expect(range.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true');
    await range.getByRole('button', { name: '7 days' }).click();
    await expect(range.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Compare with a seeded demo search', () => {
  // No mock for /api/search here: the server reads the Samsung search that npm run seed saves, so
  // no SerpApi call runs. It has 12 listings, and the cheapest is Etoren at S$1336.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
    await page.route('**/api/worth-it*', (route) => route.fulfill({ json: worthIt }));
  });

  /** @param {import('@playwright/test').Page} page */
  async function searchSamsung(page) {
    await page.goto('/');
    const box = page.getByRole('combobox').first();
    await box.fill('Samsung Galaxy S25 Ultra');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/compare\?q=Samsung/);
  }

  test('user searches from Home and sees every listing with the cheapest marked', async ({ page }) => {
    await searchSamsung(page);

    await expect(page.getByText('Showing 1 to 8 of 12 listings')).toBeVisible();
    const cheapest = page.getByRole('article').filter({ hasText: 'Cheapest' });
    await expect(cheapest).toHaveCount(1);
    await expect(cheapest).toContainText('S$1336');
    await expect(cheapest).toContainText('Etoren.com');
  });

  test('user opens the cheapest listing and sees it as Your pick on the product page', async ({ page }) => {
    await searchSamsung(page);

    const cheapest = page.getByRole('article').filter({ hasText: 'Cheapest' });
    await cheapest.getByRole('link').first().click();

    await expect(page).toHaveURL(/\/product\/1487224435158991865/);
    const stats = page.getByRole('list').filter({ hasText: 'Usual price' });
    await expect(stats).toContainText('Your pick');
    await expect(stats).toContainText('S$1336.00');
  });

  test('user sees the search under Recent searches and can remove it', async ({ page }) => {
    // A logged-out user's recent searches stay in this browser only.
    await searchSamsung(page);
    await page.goto('/');

    const box = page.getByRole('combobox').first();
    await box.click();
    const recent = page.getByRole('option', { name: /Samsung Galaxy S25 Ultra/i });
    await expect(recent).toBeVisible();
    await expect(recent).toContainText('Recent search');

    await page.getByRole('button', { name: /^Remove .*Samsung Galaxy S25 Ultra.* from recent searches$/i }).click();
    await expect(recent).toHaveCount(0);
  });
});
