// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Admin dashboard', () => {
  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
  });

  test('admin can switch the insights to the last 30 days @admin', async ({ page }) => {
    await page.goto('/admin');

    const last30 = page.getByRole('button', { name: 'Last 30 days' });
    await last30.click();

    await expect(last30).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Compared to previous 30 days').first()).toBeVisible();
  });

  test('admin can search users by username @admin', async ({ page }) => {
    await page.goto('/admin');

    await page.getByLabel('Search users by username or email').fill('demouser');

    await expect(page.getByText('demo.user@smu.edu.sg')).toBeVisible();
    // Never click Promote or Demote: the test only reads the list.
    await expect(page.getByText('demo@smu.edu.sg', { exact: true })).toHaveCount(0);
  });
});
