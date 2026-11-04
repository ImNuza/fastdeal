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

  test('admin sees You on their own row instead of a role button @admin', async ({ page }) => {
    await page.goto('/admin');
    await page.getByLabel('Search users by username or email').fill('demo@smu.edu.sg');

    await expect(page.getByText('demo@smu.edu.sg', { exact: true })).toBeVisible();
    await expect(page.getByText('You', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Promote|Demote)$/ })).toHaveCount(0);
  });

  test('admin can list only the admins with the Admins tab @admin', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Admins' }).click();

    await expect(page.getByText('demo@smu.edu.sg', { exact: true })).toBeVisible();
    await expect(page.getByText('demo.user@smu.edu.sg', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Total: \d+ admins?/)).toBeVisible();
  });

  test('admin can promote a user and demote them back, after a confirm pop-up @admin', async ({ page, request }) => {
    // bernardlo is a team account with the role "user". The test puts it back to "user" at the end.
    const token = page.waitForRequest((req) => req.url().includes('/api/admin/') && 'authorization' in req.headers());
    await page.goto('/admin');
    const authorization = (await token).headers()['authorization'];
    await page.getByLabel('Search users by username or email').fill('bernardlo');
    await expect(page.getByText('lobernard07@gmail.com')).toBeVisible();

    try {
      // Cancel changes nothing.
      await page.getByRole('button', { name: 'Promote', exact: true }).click();
      const promote = page.getByRole('dialog', { name: 'Promote user' });
      await expect(promote).toContainText('bernardlo');
      await promote.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(promote).toBeHidden();
      await expect(page.getByRole('button', { name: 'Promote', exact: true })).toBeVisible();

      // Promote.
      await page.getByRole('button', { name: 'Promote', exact: true }).click();
      await promote.getByRole('button', { name: 'Promote', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'bernardlo is now an admin.' })).toBeVisible();
      await expect(page.getByRole('tabpanel').getByText('Admin', { exact: true })).toBeVisible();

      // Demote back.
      await page.getByRole('button', { name: 'Demote', exact: true }).click();
      await page.getByRole('dialog', { name: 'Demote user' }).getByRole('button', { name: 'Demote', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'bernardlo is now a user.' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Promote', exact: true })).toBeVisible();
    } finally {
      // Put the role back even when a step above failed.
      const users = await (await request.get('/api/admin/users', { headers: { Authorization: authorization } })).json();
      const list = Array.isArray(users) ? users : users.users;
      const bernardlo = list.find((user) => user.username === 'bernardlo');
      if (bernardlo && bernardlo.role !== 'user') {
        await request.put('/api/admin/users/' + bernardlo.firebaseUid + '/role', {
          headers: { Authorization: authorization },
          data: { role: 'user' }
        });
      }
    }
  });
});
