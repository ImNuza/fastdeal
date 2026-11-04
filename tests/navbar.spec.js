// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Navigation bar', () => {
  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
  });

  test('user who is logged out sees Account go to the login page and no Admin link', async ({ page }) => {
    await page.goto('/trending');
    const nav = page.getByRole('navigation');

    await expect(nav.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/login');
    await expect(nav.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  test('user who is logged in sees their username and no Admin link @user', async ({ page }) => {
    await page.goto('/trending');
    const nav = page.getByRole('navigation');

    const account = nav.getByRole('link', { name: /Account/ });
    await expect(account).toHaveAttribute('href', '/account');
    await expect(account).toContainText('demouser');
    await expect(nav.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  test('admin can open the dashboard from the Admin link @admin', async ({ page }) => {
    await page.goto('/trending');
    await page.getByRole('navigation').getByRole('link', { name: 'Admin' }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

    test('user can open the menu and go to Friends @user', async ({ page }) => {
      await page.goto('/trending');
      const nav = page.getByRole('navigation');
      const friends = nav.getByRole('link', { name: 'Friends' });
      await expect(friends).toBeHidden();

      const menu = nav.getByRole('button', { name: 'Menu' });
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await friends.click();

      await expect(page).toHaveURL(/\/friends$/);
      await expect(page.getByRole('heading', { name: 'Friend List' })).toBeVisible();
    });

    test('user can search from the search button beside the menu', async ({ page }) => {
      // The Samsung search is one of the demo searches that npm run seed saves, so no SerpApi call runs.
      await page.goto('/trending');
      await page.getByRole('navigation').getByRole('button', { name: 'Search', exact: true }).click();

      const box = page.getByRole('combobox').first();
      await expect(box).toBeFocused();
      await box.fill('Samsung Galaxy S25 Ultra');
      await box.press('Enter');

      await expect(page).toHaveURL(/\/compare\?q=Samsung/);
      await expect(page.getByRole('article').first()).toBeVisible();
    });
  });
});
