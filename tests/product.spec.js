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

  test('user sees the AI Worth it verdict without a click, with what it was based on', async ({ page }) => {
    await page.goto('/product/' + productIphone.productId + '?q=iphone%2016');

    await expect(page.getByRole('heading', { name: 'Worth it?' })).toBeVisible();
    await expect(page.getByText(worthIt.headline)).toBeVisible();
    await expect(page.getByText(worthIt.reason)).toBeVisible();
    await expect(page.getByText('Based on: ' + worthIt.summary)).toBeVisible();
  });

  test('user can open what the AI read: every input, its source and the prompt', async ({ page }) => {
    await page.goto('/product/' + productIphone.productId + '?q=iphone%2016');
    await page.getByRole('link', { name: 'See what the AI read' }).click();

    await expect(page).toHaveURL(new RegExp('/product/' + productIphone.productId + '/worth-it'));
    await expect(page.getByRole('heading', { level: 1, name: 'How the AI decided' })).toBeVisible();
    await expect(page.getByText(worthIt.headline)).toBeVisible();

    // One row per input, with Sent or Not sent.
    const cheapestRow = page.getByRole('row', { name: /Cheapest total now/ });
    await expect(cheapestRow).toContainText('S$806.00 at Swiftronics USA');
    await expect(cheapestRow).toContainText('Sent');
    await expect(page.getByRole('row', { name: /Price history/ })).toContainText('Not sent');
    await expect(page.getByText('7 of 8 inputs were sent.', { exact: false })).toBeVisible();

    // The exact prompt opens on click.
    await page.getByText('Show the text sent to Gemini').click();
    await expect(page.getByText('You are a shopping adviser for Singapore shoppers.', { exact: false })).toBeVisible();

    await page.getByRole('link', { name: 'Back to the product' }).click();
    await expect(page.getByRole('heading', { level: 1, name: productIphone.title })).toBeVisible();
  });
});
