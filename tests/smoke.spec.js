// @ts-check
import { test, expect } from '@playwright/test';
import searchIphone from './fixtures/search-iphone.json' with { type: 'json' };

test.describe('Smoke tests', () => {
  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
  });

  test('user can open the home page and see the search box', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel('Product name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
  });

  test('user can search for a product and see result cards', async ({ page }) => {
    // Never call SerpApi from a test. Return the saved response instead.
    await page.route('**/api/search*', (route) => route.fulfill({ json: searchIphone }));

    await page.goto('/');
    await page.getByLabel('Product name').fill('iphone 16');
    await page.getByRole('button', { name: 'Search', exact: true }).click();

    await expect(page).toHaveURL(/\/compare\?q=iphone/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Apple iPhone 16', exact: true }).first()).toBeVisible();
  });

  test('user who is logged out is sent to the login page from the wishlist', async ({ page }) => {
    await page.goto('/wishlist');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('admin can open the admin dashboard @admin', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Manage Users' })).toBeVisible();
  });

  test('user who is not an admin cannot see the admin page @user', async ({ page }) => {
    // demo.user@smu.edu.sg has the role "user". The router shows an alert and stays out of /admin.
    let alertText = '';
    page.on('dialog', async (dialog) => {
      alertText = dialog.message();
      await dialog.dismiss();
    });

    await page.goto('/admin');

    await expect.poll(() => alertText).toContain('Access denied');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toHaveCount(0);
  });
});
