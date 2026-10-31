// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Account settings', () => {
  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
  });

  test('user can save a Telegram username and keep it after a reload @user', async ({ page }) => {
    await page.goto('/account');

    const telegram = page.getByLabel('Telegram username');
    await expect(telegram).toBeVisible();
    const original = await telegram.inputValue();
    const newValue = original === 'e2e_tester' ? 'e2e_tester2' : 'e2e_tester';

    try {
      await telegram.fill(newValue);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByText('Saved!')).toBeVisible();

      await page.reload();
      await expect(page.getByLabel('Telegram username')).toHaveValue(newValue);
    } finally {
      // Put the old value back.
      await page.goto('/account');
      await page.getByLabel('Telegram username').fill(original);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByText('Saved!')).toBeVisible();
    }
  });

  test('user can turn the email alerts checkbox on or off and keep it after a reload @user', async ({ page }) => {
    await page.goto('/account');

    const emailAlerts = page.getByRole('checkbox', { name: 'Email me when a saved price drops' });
    await expect(emailAlerts).toBeVisible();
    const original = await emailAlerts.isChecked();

    try {
      // Wait for the server to save the change before the reload.
      const saved = page.waitForResponse((response) =>
        response.url().includes('/api/users/me') && response.request().method() === 'PUT'
      );
      await emailAlerts.setChecked(!original);
      await saved;

      await page.reload();
      await expect(page.getByRole('checkbox', { name: 'Email me when a saved price drops' })).toBeChecked({ checked: !original });
    } finally {
      // Put the old value back.
      await page.goto('/account');
      const restore = page.getByRole('checkbox', { name: 'Email me when a saved price drops' });
      await expect(restore).toBeVisible();
      if ((await restore.isChecked()) !== original) {
        const restored = page.waitForResponse((response) =>
          response.url().includes('/api/users/me') && response.request().method() === 'PUT'
        );
        await restore.setChecked(original);
        await restored;
      }
    }
  });
});
