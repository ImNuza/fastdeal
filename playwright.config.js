// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(import.meta.dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* The first requests after the servers start can be slow (MongoDB connect), so wait up to 10s per check. */
  expect: { timeout: 10000 },
  /* Each save goes to MongoDB Atlas, so a test with several saves can pass 30s when 7 workers run at once. */
  timeout: 60000,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects. Chromium only. */
  projects: [
    /* Logs in both demo accounts once through the login page and saves the sessions. */
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },

    /*
     * Convention: a test that needs a login has a tag in its title.
     * @admin runs as demo@smu.edu.sg (admin). @user runs as demo.user@smu.edu.sg (normal user).
     * "logged-out" runs every test without a tag.
     */
    {
      name: 'logged-out',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@admin|@user/,
    },

    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
      grep: /@admin/,
    },

    {
      name: 'user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      grep: /@user/,
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'npm run start',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
  ],
});
