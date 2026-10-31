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

  test('admin who opens a Buy together invite from an old friend sees that it expired @admin', async ({ page }) => {
    // An invite from a user who is no longer a friend. The server answers 403 for their profile.
    const invite = {
      ...notifications[2],
      _id: '000000000000000000000009',
      type: 'group-invite',
      title: 'marvelnt wants to buy together!',
      body: 'marvelnt saved Apple iPhone 16 Pro Max Titanium and wants to split the shipping.',
      link: '/notifications',
      productKey: 'apple iphone 16 pro max titanium',
      fromUid: 'e2e-old-friend',
      read: false
    };
    await page.route('**/api/notifications', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: [invite, ...notifications] });
      }
      return route.fallback();
    });
    await page.route('**/api/users/profile/*', (route) => route.fulfill({ status: 403, json: { error: 'Not friends' } }));

    await page.goto('/notifications');
    await page.getByRole('tab', { name: 'Friends' }).click();
    await page.getByRole('button', { name: 'Buy Together', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Buy together' });
    await expect(dialog.getByText('You are no longer friends with marvelnt, so this invite expired.')).toBeVisible();
    await expect(dialog.getByRole('link', { name: /Message .* on Telegram/ })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
  });
});
