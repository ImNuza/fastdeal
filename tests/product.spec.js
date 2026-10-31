// @ts-check
import { test, expect } from '@playwright/test';
import productIphone from './fixtures/product-iphone.json' with { type: 'json' };
import worthIt from './fixtures/worth-it.json' with { type: 'json' };

test.describe('Product page', () => {
  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  // Never call SerpApi or Gemini from a test. Return the saved responses instead.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
    await page.route('**/api/product/*', (route) => route.fulfill({ json: productIphone }));
    await page.route('**/api/worth-it*', (route) => route.fulfill({ json: worthIt }));
  });

  test('user can see the product name and the lowest price', async ({ page }) => {
    await page.goto('/product/' + productIphone.productId + '?q=iphone%2016');

    await expect(page.getByRole('heading', { level: 1, name: productIphone.title })).toBeVisible();

    // The cheapest store comes first, so its total is the lowest price.
    const cheapest = productIphone.stores[0];
    await expect(page.getByText('Cheapest total is S$' + cheapest.total.toFixed(2) + ' at ' + cheapest.store)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'All stores' })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(cheapest.store) })).toBeVisible();
  });

  test('user can open the AI Worth it verdict and read its advice', async ({ page }) => {
    await page.goto('/product/' + productIphone.productId + '?q=iphone%2016');

    // The verdict is hidden until the user asks for it.
    const toggle = page.getByRole('button', { name: /Show the .Worth it\?. verdict/ });
    await expect(toggle).toBeVisible();
    await expect(page.getByText(worthIt.headline)).toBeHidden();

    await toggle.click();
    await expect(page.getByRole('heading', { name: 'Worth it?' })).toBeVisible();
    await expect(page.getByText(worthIt.headline)).toBeVisible();
    await expect(page.getByText(worthIt.reason)).toBeVisible();
    await expect(page.getByRole('button', { name: /Hide the .Worth it\?. verdict/ })).toBeVisible();
  });
});
