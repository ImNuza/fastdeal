// @ts-check
import { test, expect } from '@playwright/test';
import searchIphone from './fixtures/search-iphone.json' with { type: 'json' };
import productIphone from './fixtures/product-iphone.json' with { type: 'json' };

// Live prices the wishlist finds for the two demo products. Any other name gets the saved iPhone search.
// Sony: saved at S$489, now S$429, so it counts as a price drop. Kindle: saved at S$219, now S$219.
const LIVE_PRICES = { 'Sony WH-1000XM5': 429, 'Kindle Paperwhite': 219 };

const PRODUCT_URL = '/product/' + productIphone.productId + '?q=iphone%2016';
const NAME = productIphone.title;

const isWishlistList = (response) =>
  new URL(response.url()).pathname === '/api/wishlist' && response.request().method() === 'GET';

// Open a page and wait until the login is restored and the saved products are loaded.
async function open(page, path) {
  const loaded = page.waitForResponse(isWishlistList);
  await page.goto(path);
  await loaded;
}

// Take the iPhone off the wishlist of demo.user, also after an earlier failed run.
async function clearProduct(page) {
  const remove = page.getByRole('button', { name: 'Remove ' + NAME, exact: true });
  const empty = page.getByText('No saved products yet');
  const sleeping = page.getByText(/Sleeping on it, /);

  await open(page, '/wishlist');
  await expect(remove.or(empty).or(sleeping)).toBeVisible();
  if (await empty.isVisible()) return;

  // A product on hold has no Remove button until the hold ends. The test holds for one minute.
  if (await sleeping.isVisible()) {
    await expect(async () => {
      await page.reload();
      await expect(remove).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 100000, intervals: [3000] });
  }

  const deleted = page.waitForResponse((response) =>
    new URL(response.url()).pathname.startsWith('/api/wishlist/') && response.request().method() === 'DELETE');
  await remove.click();
  await deleted;
  await expect(empty).toBeVisible();
}

// Save the iPhone from its product page.
async function saveProduct(page) {
  await open(page, PRODUCT_URL);
  await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible();

  const saved = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/wishlist' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved;
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
}

test.describe('Wishlist', () => {
  // Tests 13 and 15 save and remove the same product for demo.user, so run this file in order.
  test.describe.configure({ mode: 'default' });

  // Skip the welcome prompt that first-time visitors see. It stores the choice in sessionStorage.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'));

    // Never call SerpApi from a test. The wishlist checks a live price for every saved product.
    await page.route('**/api/search*', (route) => {
      const q = new URL(route.request().url()).searchParams.get('q') || '';
      const price = LIVE_PRICES[q];
      if (!price) return route.fulfill({ json: searchIphone });
      return route.fulfill({
        json: { ...searchIphone, listings: [{ ...searchIphone.listings[0], name: q, store: 'Shopee', price }] }
      });
    });

    // Never send a real target price email.
    await page.route('**/api/wishlist/*/check-target', (route) => route.fulfill({
      json: { checked: false, reason: 'e2e-test' }
    }));

    // The product page comes from the saved response too.
    await page.route('**/api/product/*', (route) => route.fulfill({ json: productIphone }));
  });

  test('user can save a product from its page, see it on the wishlist and remove it @user', async ({ page }) => {
    try {
      await clearProduct(page);
      await saveProduct(page);

      await open(page, '/wishlist');
      await expect(page.getByText(NAME, { exact: true })).toBeVisible();

      const deleted = page.waitForResponse((response) =>
        new URL(response.url()).pathname.startsWith('/api/wishlist/') && response.request().method() === 'DELETE');
      await page.getByRole('button', { name: 'Remove ' + NAME, exact: true }).click();
      await deleted;

      await expect(page.getByText(NAME, { exact: true })).toBeHidden();
      await expect(page.getByText('No saved products yet')).toBeVisible();
    } finally {
      await clearProduct(page);
    }
  });

  test('user can search the wishlist, sort it and filter it with the tabs @admin', async ({ page }) => {
    await open(page, '/wishlist');
    const sony = page.getByText('Sony WH-1000XM5', { exact: true });
    const kindle = page.getByText('Kindle Paperwhite', { exact: true });
    await expect(sony).toBeVisible();
    await expect(kindle).toBeVisible();

    // Search narrows the list.
    const search = page.getByLabel('Search your wishlist');
    await search.fill('kindle');
    await expect(kindle).toBeVisible();
    await expect(sony).toBeHidden();

    await search.fill('zzzznothing');
    await expect(page.getByText('No saved products match')).toBeVisible();
    await search.fill('');
    await expect(sony).toBeVisible();

    // Sort by changes the order of the product links.
    const products = page.getByRole('link', { name: /Kindle Paperwhite|Sony WH-1000XM5/ });
    const sort = page.getByLabel('Sort by');

    await sort.selectOption('Name: A to Z');
    await expect(products).toHaveText([/Kindle Paperwhite/, /Sony WH-1000XM5/]);

    await sort.selectOption('Name: Z to A');
    await expect(products).toHaveText([/Sony WH-1000XM5/, /Kindle Paperwhite/]);

    await sort.selectOption('Price: Low to High');
    await expect(products).toHaveText([/Kindle Paperwhite/, /Sony WH-1000XM5/]);

    await sort.selectOption('Price: High to Low');
    await expect(products).toHaveText([/Sony WH-1000XM5/, /Kindle Paperwhite/]);

    // Price drops shows only the product that is cheaper than when it was saved.
    await page.getByRole('tab', { name: 'Price drops' }).click();
    await expect(sony).toBeVisible();
    await expect(kindle).toBeHidden();

    // Nothing in the seed data is on hold.
    await page.getByRole('tab', { name: 'Sleeping on it' }).click();
    await expect(page.getByText('Nothing on hold')).toBeVisible();
    await expect(sony).toBeHidden();
  });

  test('user can put a saved product on hold and find it under Sleeping on it @user', async ({ page }) => {
    test.setTimeout(180000);

    try {
      await clearProduct(page);
      await saveProduct(page);

      await open(page, '/wishlist');
      await page.getByRole('button', { name: 'Sleep on ' + NAME, exact: true }).click();

      // The hold starts at 1 day. Change it to 1 minute so the cleanup can remove the product.
      const dialog = page.getByRole('dialog', { name: 'Sleep on it' });
      await dialog.getByRole('button', { name: 'One less day', exact: true }).click();
      await dialog.getByRole('button', { name: 'One more minute', exact: true }).click();
      await expect(dialog.getByLabel('Days', { exact: true })).toHaveValue('0');
      await expect(dialog.getByLabel('Minutes', { exact: true })).toHaveValue('01');

      const held = page.waitForResponse((response) =>
        new URL(response.url()).pathname.startsWith('/api/wishlist/') && response.request().method() === 'PATCH');
      await dialog.getByRole('button', { name: 'Proceed', exact: true }).click();
      await held;
      await expect(dialog).toBeHidden();

      await page.getByRole('tab', { name: 'Sleeping on it' }).click();
      await expect(page.getByText(NAME, { exact: true })).toBeVisible();
      await expect(page.getByText(/Sleeping on it, .+ left/)).toBeVisible();
    } finally {
      await clearProduct(page);
    }
  });

  test('user can plan a budget and the plan stays under it @admin', async ({ page }) => {
    await open(page, '/wishlist');
    await page.getByRole('tab', { name: 'Plan a budget' }).click();
    await page.getByRole('button', { name: 'New budget', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Plan a budget' });
    await dialog.getByRole('checkbox', { name: 'Sony WH-1000XM5' }).check();
    await dialog.getByRole('checkbox', { name: 'Kindle Paperwhite' }).check();

    // Both products fit in S$700: S$429 and S$219 come to S$648.
    await dialog.getByLabel('Your budget').fill('700');
    await expect(async () => {
      await dialog.getByRole('button', { name: 'Find best combination' }).click();
      await expect(dialog.getByText('S$648.00')).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20000 });
    await expect(dialog.getByText('S$52.00 left of S$700.00')).toBeVisible();

    // A smaller budget cannot hold both, so the total drops under it.
    await dialog.getByLabel('Your budget').fill('300');
    await dialog.getByRole('button', { name: 'Find best combination' }).click();
    await expect(dialog.getByText('left of S$300.00')).toBeVisible();
    const total = await dialog.getByText(/^Total S\$/).textContent();
    expect(Number((total || '').replace(/[^0-9.]/g, ''))).toBeLessThanOrEqual(300);

    // Close without saving, so the demo account keeps no new budget.
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test('user can see which friends saved the same product and open Buy together @admin', async ({ page }) => {
    // Buy together asks for a Telegram ID first. Give the page one, without changing the database.
    await page.route('**/api/users/me', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      const body = await response.json();
      return route.fulfill({ response, json: { ...body, telegramUsername: 'demo_tg' } });
    });

    await open(page, '/wishlist');
    await page.getByRole('button', { name: /friends? saved Sony WH-1000XM5\. Buy together/ }).click();

    const dialog = page.getByRole('dialog', { name: 'Buy together' });
    await expect(dialog.getByRole('heading', { name: 'Buy together' })).toBeVisible();
    await expect(dialog.getByText('Sony WH-1000XM5')).toBeVisible();

    // alex.tan is the seed friend who saved the Sony headphones. priya_k saved other products.
    await expect(dialog.getByText('alex.tan', { exact: true })).toBeVisible();
    await expect(dialog.getByText('priya_k', { exact: true })).toBeHidden();

    // Close without sending an invite.
    await dialog.getByRole('button', { name: /^(Cancel|Done)$/ }).click();
    await expect(dialog).toBeHidden();
  });
});
