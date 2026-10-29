// @ts-check
import { test, expect } from '@playwright/test';
import productIphone from './fixtures/product-iphone.json' with { type: 'json' };

test.describe('Product page', () => {
  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
  });

  test('user can see the product name and the lowest price', async ({ page }) => {
    // Never call SerpApi from a test. Return the saved response instead.
    await page.route('**/api/product/*', (route) => route.fulfill({ json: productIphone }));

    await page.goto('/product/' + productIphone.productId + '?q=iphone%2016');

    await expect(page.getByRole('heading', { level: 1, name: productIphone.title })).toBeVisible();

    // The cheapest store comes first, so its total is the lowest price.
    const cheapest = productIphone.stores[0];
    await expect(page.getByText('Cheapest total is S$' + cheapest.total.toFixed(2) + ' at ' + cheapest.store)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'All stores' })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(cheapest.store) })).toBeVisible();
  });
});
