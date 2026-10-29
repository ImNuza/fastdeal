// @ts-check
import { test as setup, expect } from '@playwright/test';

// Both demo accounts use the same password. See README.txt.
const accounts = [
  { name: 'admin', email: 'demo@smu.edu.sg', authFile: 'playwright/.auth/admin.json' },
  { name: 'user', email: 'demo.user@smu.edu.sg', authFile: 'playwright/.auth/user.json' },
];

for (const account of accounts) {
  setup('log in as the demo ' + account.name + ' and save the session', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Username or Email').fill(account.email);
    await page.getByPlaceholder('Password').fill(process.env.E2E_DEMO_PASSWORD ?? '');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();

    // Login is done when the page leaves /login.
    await expect(page).not.toHaveURL(/\/login/);

    // Firebase keeps the session in IndexedDB, so save it too.
    await page.context().storageState({ path: account.authFile, indexedDB: true });
  });
}
