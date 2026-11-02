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
    await expect(page.getByRole('heading', { name: 'All stores' })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(cheapest.store) })).toBeVisible();
    // The team removed the Deal check, so the store table has no Deal check column.
    await expect(page.getByRole('columnheader', { name: 'Deal check' })).toHaveCount(0);
  });

  test('user sees the AI Worth it verdict without a click, with what it was based on', async ({ page }) => {
    await page.goto('/product/' + productIphone.productId + '?q=iphone%2016');

    await expect(page.getByRole('heading', { name: 'Worth it?' })).toBeVisible();
    // The tag shows a fixed label for the decision, not the AI's own headline.
    await expect(page.getByText('Wait for a sale', { exact: true })).toBeVisible();
    await expect(page.getByText(worthIt.reason)).toBeVisible();
    await expect(page.getByText('Based on: ' + worthIt.summary)).toBeVisible();
  });

  test('user can open how the AI decided in a pop-up and close it', async ({ page }) => {
    await page.goto('/product/' + productIphone.productId + '?q=iphone%2016');
    await page.getByRole('button', { name: 'See how the AI decided' }).click();

    const dialog = page.getByRole('dialog', { name: 'How the AI decided' });
    await expect(dialog).toBeVisible();
    // The steps quote the numbers the AI used.
    await expect(dialog.getByText('Found the cheapest total today: S$806.00 at Swiftronics USA.')).toBeVisible();
    // FastDeal has no price history, so the AI never reads one.
    await expect(dialog.getByText('Price history')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Got it' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: productIphone.title })).toBeVisible();
  });

  test('user sees a clear note when the AI did not answer and the verdict comes from fixed rules', async ({ page }) => {
    const rules = {
      ...worthIt,
      decision: 'buy',
      headline: 'Good price now',
      reason: 'The cheapest total S$806.00 is 12% under the typical S$916.00 across 5 stores.',
      source: 'rules'
    };
    await page.route('**/api/worth-it*', (route) => route.fulfill({ json: rules }));
    await page.goto('/product/' + productIphone.productId + '?q=iphone%2016');

    await expect(page.getByText(rules.reason)).toBeVisible();
    await expect(page.getByText('The AI did not answer, so this is an estimate', { exact: false })).toBeVisible();
  });
});
