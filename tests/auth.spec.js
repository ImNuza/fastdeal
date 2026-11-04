// @ts-check
import { test, expect } from '@playwright/test';

// Tests must not create users, so the sign-up tests stop at the form's own checks, before Firebase.
// The login tests use a username that does not exist, so no real account gets a failed login.

test.describe('Log in, sign up and log out', () => {
  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));
  });

  test('user sees a message when they log in with an empty form', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();

    await expect(page.getByText('Enter your username or email, and your password.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('user sees a message when the username does not exist', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username or Email', { exact: true }).fill('no_such_user_e2e');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();

    await expect(page.getByText('Username/email or password is wrong.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('user who logs in with a username goes back to the page they wanted', async ({ page }) => {
    // A logged-out user who opens Friends is sent to log in first.
    await page.goto('/friends');
    await expect(page).toHaveURL(/\/login\?next=/);

    // demo.user@smu.edu.sg has the username demouser. See README.txt.
    await page.getByLabel('Username or Email', { exact: true }).fill('demouser');
    await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_DEMO_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();

    await expect(page).toHaveURL(/\/friends$/);
    await expect(page.getByRole('heading', { name: 'Friend List' })).toBeVisible();
  });

  test('user sees a message when the sign-up form is empty', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Fill in username, email and password.')).toBeVisible();
  });

  test('user sees a message when the username has characters that are not allowed', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Username', { exact: true }).fill('Bad Name!');
    await page.getByLabel('Email', { exact: true }).fill('e2e.signup@example.com');
    await page.getByLabel('Password', { exact: true }).fill('secret123');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText(/^Username: 3.20 characters/)).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('user sees a message when the password is shorter than 6 characters', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Username', { exact: true }).fill('e2e_signup');
    await page.getByLabel('Email', { exact: true }).fill('e2e.signup@example.com');
    await page.getByLabel('Password', { exact: true }).fill('12345');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Password must be at least 6 characters.')).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('user sees a message when the Telegram username is too short', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Username', { exact: true }).fill('e2e_signup');
    await page.getByLabel('Email', { exact: true }).fill('e2e.signup@example.com');
    await page.getByLabel('Password', { exact: true }).fill('secret123');
    await page.getByLabel('Telegram username').fill('@abc');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText(/^Telegram username must be 5.32 characters/)).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('user sees a pop-up before logging out, and Cancel keeps them logged in @user', async ({ page }) => {
    await page.goto('/account');
    await page.getByRole('button', { name: 'Log out', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Log out' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible();
  });

  test('user who logs out goes home and must log in again to see the wishlist @user', async ({ page }) => {
    // Logging out here clears only this browser. The saved session file the other tests use stays.
    await page.goto('/account');
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('dialog', { name: 'Log out' }).getByRole('button', { name: 'Log out', exact: true }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/login');

    await page.goto('/wishlist');
    await expect(page).toHaveURL(/\/login/);
  });
});
