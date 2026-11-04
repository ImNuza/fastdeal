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
});

// The login token the page sends to the API. The page gets it from the saved session.
/** @param {import('@playwright/test').Page} page */
async function tokenOf(page) {
  const call = page.waitForRequest((req) => req.url().includes('/api/') && 'authorization' in req.headers());
  await page.goto('/account');
  return (await call).headers()['authorization'];
}

test.describe('Friend requests between demo.user and demo', () => {
  // Each test sends a request from demo.user to demo, so they run one at a time.
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').BrowserContext} */
  let adminContext;
  /** @type {import('@playwright/test').Page} */
  let adminPage;

  test.beforeEach(async ({ page, browser }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
    // Second browser context, logged in as demo (admin), who receives the request.
    adminContext = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    await adminContext.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
    adminPage = await adminContext.newPage();
  });

  // Delete the friendship or request between the two accounts, so the database goes back to
  // normal even when a step failed. demo.user has no friends after npm run seed.
  test.afterEach(async ({ page, request }) => {
    const userToken = await tokenOf(page);
    const adminToken = await tokenOf(adminPage);
    const me = await (await request.get('/api/users/me', { headers: { Authorization: userToken } })).json();
    const demo = await (await request.get('/api/users/me', { headers: { Authorization: adminToken } })).json();
    const pairKey = [me.firebaseUid, demo.firebaseUid].sort().join('|');
    await request.delete('/api/friends/' + encodeURIComponent(pairKey), { headers: { Authorization: userToken } });
    await adminContext.close();
  });

  // Searching "demo" also finds fastdealdemo (the presentation account), so take the button in the
  // row whose username is exactly "demo": the deepest block that holds both.
  /** @param {import('@playwright/test').Page} page */
  function demoRow(page) {
    return page.locator('div')
      .filter({ has: page.getByText('demo', { exact: true }) })
      .filter({ has: page.getByRole('button') })
      .last();
  }

  // Send a request from demo.user to demo on the Add Friend tab.
  /** @param {import('@playwright/test').Page} page */
  async function sendRequest(page) {
    await page.goto('/friends');
    await page.getByRole('tab', { name: 'Add Friend' }).click();
    await page.getByLabel('Search people by username').fill('demo');
    await demoRow(page).getByRole('button', { name: 'Add friend', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cancel the request to demo', exact: true })).toBeVisible();
  }

  test('user can send a friend request that the other user then sees @user', async ({ page }) => {
    await sendRequest(page);

    // demo sees it under Requests on the Friends page.
    await adminPage.goto('/friends');
    await adminPage.getByRole('tab', { name: 'Requests' }).click();
    await expect(adminPage.getByText('demouser', { exact: true })).toBeVisible();

    // demo also gets a friend request notice in the Friends tab on Notifications.
    await adminPage.goto('/notifications');
    await adminPage.getByRole('tab', { name: 'Friends' }).click();
    await expect(adminPage.getByText('demouser sent you a friend request.').first()).toBeVisible();
  });

  test('admin can accept a friend request, and both see each other as friends @user', async ({ page }) => {
    await sendRequest(page);

    await adminPage.goto('/friends');
    await adminPage.getByRole('tab', { name: 'Requests' }).click();
    const request = adminPage.locator('div')
      .filter({ has: adminPage.getByText('demouser', { exact: true }) })
      .filter({ has: adminPage.getByRole('button', { name: 'Accept' }) })
      .last();
    await request.getByRole('button', { name: 'Accept' }).click();
    await expect(adminPage.getByRole('button', { name: 'Decline demouser' })).toHaveCount(0);

    // demo's friend list now has demouser.
    await adminPage.getByRole('tab', { name: 'Friends' }).click();
    await adminPage.getByLabel('Search your friends').fill('demouser');
    await expect(adminPage.getByText('demouser', { exact: true })).toBeVisible();

    // demouser's friend list has demo.
    await page.goto('/friends');
    await expect(page.getByRole('button', { name: 'Remove demo as a friend', exact: true })).toBeVisible();
  });

  test('admin can decline a friend request, and the sender can ask again @user', async ({ page }) => {
    await sendRequest(page);

    await adminPage.goto('/friends');
    await adminPage.getByRole('tab', { name: 'Requests' }).click();
    await adminPage.getByRole('button', { name: 'Decline demouser' }).click();
    await expect(adminPage.getByRole('button', { name: 'Decline demouser' })).toHaveCount(0);

    // The request is gone for the sender too, so Add friend shows again.
    await page.goto('/friends');
    await page.getByRole('tab', { name: 'Add Friend' }).click();
    await page.getByLabel('Search people by username').fill('demo');
    await expect(demoRow(page).getByRole('button', { name: 'Add friend', exact: true })).toBeVisible();
  });

  test('user can remove a friend after the pop-up asks first @user', async ({ page }) => {
    await sendRequest(page);
    await adminPage.goto('/friends');
    await adminPage.getByRole('tab', { name: 'Requests' }).click();
    await adminPage.locator('div')
      .filter({ has: adminPage.getByText('demouser', { exact: true }) })
      .filter({ has: adminPage.getByRole('button', { name: 'Accept' }) })
      .last()
      .getByRole('button', { name: 'Accept' })
      .click();
    await expect(adminPage.getByRole('button', { name: 'Decline demouser' })).toHaveCount(0);

    await page.goto('/friends');
    await page.getByRole('button', { name: 'Remove demo as a friend', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remove friend' }).getByRole('button', { name: 'Remove', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Remove demo as a friend', exact: true })).toHaveCount(0);
  });
});
