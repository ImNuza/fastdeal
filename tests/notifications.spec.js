// @ts-check
import { test, expect } from '@playwright/test';
import notifications from './fixtures/notifications.json' with { type: 'json' };

test.describe('Notifications', () => {
  // Skip the welcome popup. Return the saved notifications and block the read endpoints,
  // so nothing in these tests reaches the database.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));

    await page.route('**/api/notifications', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: notifications });
      }
      return route.fallback();
    });
    await page.route('**/api/notifications/*/read', (route) => route.fulfill({ json: { ok: true } }));
    await page.route('**/api/notifications/read-all', (route) => route.fulfill({ json: { ok: true } }));
  });

  test('admin can filter notifications by the Wishlist and Friends tabs @admin', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.getByText('Price drop: Sony WH-1000XM5')).toBeVisible();

    await page.getByRole('tab', { name: 'Wishlist' }).click();
    await expect(page.getByText('Price drop: Sony WH-1000XM5')).toBeVisible();
    await expect(page.getByText('11.11 sale starts soon')).toBeVisible();
    await expect(page.getByText('New friend request')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Friends' }).click();
    await expect(page.getByText('New friend request')).toBeVisible();
    await expect(page.getByText('Price drop: Sony WH-1000XM5')).toHaveCount(0);
  });

  test('admin can search notifications, clear the unread dots and show unread only @admin', async ({ page }) => {
    await page.goto('/notifications');

    // The search narrows the list.
    await page.getByLabel('Search notifications', { exact: true }).fill('kindle');
    await expect(page.getByText('11.11 sale starts soon')).toBeVisible();
    await expect(page.getByText('Price drop: Sony WH-1000XM5')).toHaveCount(0);
    await page.getByLabel('Search notifications', { exact: true }).fill('');

    // The unread dots go away after Mark all as read.
    await expect(page.getByLabel('Unread', { exact: true })).toHaveCount(3);
    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(page.getByLabel('Unread', { exact: true })).toHaveCount(0);

    // Unread only now hides every notification.
    await page.getByLabel('Show').selectOption('unread');
    await expect(page.getByText('No unread notifications.')).toBeVisible();
    await expect(page.getByText('Price drop: Sony WH-1000XM5')).toHaveCount(0);
  });
});
