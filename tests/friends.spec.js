// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Friends', () => {
  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
  });

  test('admin can search the friend list and see a message when nobody matches @admin', async ({ page }) => {
    await page.goto('/friends');

    // npm run seed makes the team accounts friends of demo. zoedharm is one of them.
    const search = page.getByLabel('Search your friends');
    await search.fill('zoedharm');
    await expect(page.getByText('zoedharm', { exact: true })).toBeVisible();

    await search.fill('zzzznobody');
    await expect(page.getByText('No friends match')).toBeVisible();
  });

  test('admin can see the friend request from dewa @admin', async ({ page }) => {
    // npm run seed adds a waiting request from the team account dewa.
    await page.goto('/friends');
    await page.getByRole('tab', { name: 'Requests' }).click();

    await expect(page.getByText('dewa', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Decline dewa' })).toBeVisible();
  });

  test('admin sees a pop-up before a friend is removed, and Cancel keeps the friend @admin', async ({ page }) => {
    await page.goto('/friends');
    await page.getByLabel('Search your friends').fill('zoedharm');
    await page.getByRole('button', { name: 'Remove zoedharm as a friend' }).click();

    const dialog = page.getByRole('dialog', { name: 'Remove friend' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('zoedharm', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Remove', exact: true })).toBeVisible();

    // Cancel closes it and nothing changes. Esc closes it too.
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('zoedharm', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Remove zoedharm as a friend' }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByText('zoedharm', { exact: true })).toBeVisible();
  });

  test('user can send a friend request that the other user then sees @user', async ({ page, browser }) => {
    // Second browser context, logged in as demo (admin), who receives the request.
    const adminContext = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    await adminContext.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
    const adminPage = await adminContext.newPage();

    const addButton = page.getByRole('button', { name: 'Add friend', exact: true });
    const cancelButton = page.getByRole('button', { name: 'Cancel the request to demo', exact: true });

    async function findDemo() {
      await page.goto('/friends');
      await page.getByRole('tab', { name: 'Add Friend' }).click();
      await page.getByLabel('Search people by username').fill('demo');
      await expect(page.getByText('demo', { exact: true })).toBeVisible();
    }

    try {
      // Start clean: cancel a request left over from an earlier failed run.
      await findDemo();
      await expect(addButton.or(cancelButton)).toBeVisible();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
      await expect(addButton).toBeVisible();

      // Send the request.
      await addButton.click();
      await expect(cancelButton).toBeVisible();

      // demo sees it under Requests on the Friends page.
      await adminPage.goto('/friends');
      await adminPage.getByRole('tab', { name: 'Requests' }).click();
      await expect(adminPage.getByText('demouser', { exact: true })).toBeVisible();

      // demo also gets a friend request notice in the Friends tab on Notifications.
      await adminPage.goto('/notifications');
      await adminPage.getByRole('tab', { name: 'Friends' }).click();
      await expect(adminPage.getByText('demouser sent you a friend request.').first()).toBeVisible();
    } finally {
      // Cancel the request so the database goes back to normal.
      await findDemo();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        await expect(addButton).toBeVisible();
      }
      await adminContext.close();
    }
  });
});
