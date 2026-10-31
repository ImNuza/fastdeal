// @ts-check
import { test, expect } from '@playwright/test';
import searchIphone from './fixtures/search-iphone.json' with { type: 'json' };
import productIphone from './fixtures/product-iphone.json' with { type: 'json' };
import worthIt from './fixtures/worth-it.json' with { type: 'json' };
import demoProducts from '../data/demo-products.json' with { type: 'json' };

// The demo account's products from npm run seed (data/demo-products.json), in that order:
// iPhone, Sony, Owala (Sleep on it), Dyson (sleep ended), Charizard plush (target price).
const [IPHONE, SONY, OWALA, DYSON, POKEMON] = demoProducts;

// Live prices the wishlist finds for the demo products. Any other name gets the saved iPhone search.
// The iPhone is S$138.89 (13%) cheaper than when it was saved, so it counts as a price drop (10% or more).
// The rest are unchanged.
const IPHONE_NOW = 899;
const LIVE_PRICES = {
  [IPHONE.name]: IPHONE_NOW,
  [SONY.name]: SONY.price,
  [OWALA.name]: OWALA.price,
  [DYSON.name]: DYSON.price,
  [POKEMON.name]: POKEMON.price
};

// A product name inside a RegExp, with its brackets and dots taken literally
/** @param {string} text */
function literal(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PRODUCT_URL = '/product/' + productIphone.productId + '?q=iphone%2016';
const NAME = productIphone.title;

/** @param {import('@playwright/test').Response} response */
const isWishlistList = (response) =>
  new URL(response.url()).pathname === '/api/wishlist' && response.request().method() === 'GET';

// Open a page and wait until the login is restored and the saved products are loaded.
/** @param {import('@playwright/test').Page} page @param {string} path */
async function open(page, path) {
  const loaded = page.waitForResponse(isWishlistList);
  await page.goto(path);
  await loaded;
}

// Take the iPhone off the wishlist of demo.user, also after an earlier failed run.
/** @param {import('@playwright/test').Page} page */
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
  await page.getByRole('dialog', { name: 'Remove from wishlist' }).getByRole('button', { name: 'Remove', exact: true }).click();
  await deleted;
  await expect(empty).toBeVisible();
}

// Save the iPhone from its product page.
/** @param {import('@playwright/test').Page} page */
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

    // The product page comes from the saved response too. A saved demo product gets its live price
    // from its own product page, so those return one store at the price in LIVE_PRICES.
    await page.route('**/api/product/*', (route) => {
      const id = new URL(route.request().url()).pathname.split('/').pop();
      const demo = demoProducts.find((product) => product.productId === id);
      if (!demo) return route.fulfill({ json: productIphone });
      const price = LIVE_PRICES[demo.name];
      return route.fulfill({
        json: { ...productIphone, productId: id, title: demo.name, stores: [{ ...productIphone.stores[0], store: 'Shopee', price, total: price }] }
      });
    });

    // The product page asks Gemini for a Worth it verdict. Return the saved one.
    await page.route('**/api/worth-it*', (route) => route.fulfill({ json: worthIt }));
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
      await page.getByRole('dialog', { name: 'Remove from wishlist' }).getByRole('button', { name: 'Remove', exact: true }).click();
      await deleted;

      await expect(page.getByText(NAME, { exact: true })).toBeHidden();
      await expect(page.getByText('No saved products yet')).toBeVisible();
    } finally {
      await clearProduct(page);
    }
  });

  test('user can search the wishlist, sort it and filter it with the tabs @admin', async ({ page }) => {
    await open(page, '/wishlist');
    const iphone = page.getByText(IPHONE.name, { exact: true });
    const pokemon = page.getByText(POKEMON.name, { exact: true });
    await expect(iphone).toBeVisible();
    await expect(pokemon).toBeVisible();

    // Search narrows the list.
    const search = page.getByLabel('Search your wishlist');
    await search.fill('pokemon');
    await expect(pokemon).toBeVisible();
    await expect(iphone).toBeHidden();

    await search.fill('zzzznothing');
    await expect(page.getByText('No saved products match')).toBeVisible();
    await search.fill('');
    await expect(iphone).toBeVisible();

    // Sort by changes the order of the product links.
    const products = page.getByRole('link', { name: new RegExp(literal(IPHONE.name) + '|' + literal(POKEMON.name)) });
    const sort = page.getByLabel('Sort by');
    const iphoneText = new RegExp(literal(IPHONE.name));
    const pokemonText = new RegExp(literal(POKEMON.name));

    await sort.selectOption('Name: A to Z');
    await expect(products).toHaveText([iphoneText, pokemonText]);

    await sort.selectOption('Name: Z to A');
    await expect(products).toHaveText([pokemonText, iphoneText]);

    await sort.selectOption('Price: Low to High');
    await expect(products).toHaveText([pokemonText, iphoneText]);

    await sort.selectOption('Price: High to Low');
    await expect(products).toHaveText([iphoneText, pokemonText]);

    // Price drops shows only the product that is cheaper than when it was saved.
    await page.getByRole('tab', { name: 'Price drops' }).click();
    await expect(iphone).toBeVisible();
    await expect(pokemon).toBeHidden();

    // The seed puts the Owala bottle on hold.
    await page.getByRole('tab', { name: 'Sleeping on it' }).click();
    await expect(page.getByText(OWALA.name, { exact: true })).toBeVisible();
    await expect(iphone).toBeHidden();
  });

  test('user sees a pop-up before a product is removed, and Cancel keeps it @admin', async ({ page }) => {
    await open(page, '/wishlist');
    const pokemon = page.getByText(POKEMON.name, { exact: true });
    await expect(pokemon).toBeVisible();

    await page.getByRole('button', { name: 'Remove ' + POKEMON.name, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Remove from wishlist' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Remove', exact: true })).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(pokemon).toBeVisible();
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
    await dialog.getByRole('checkbox', { name: IPHONE.name }).check();
    await dialog.getByRole('checkbox', { name: POKEMON.name }).check();

    // Both products fit in S$1100: the iPhone's live price and the Pokemon plush come to the total below.
    const both = IPHONE_NOW + POKEMON.price;
    await dialog.getByLabel('Your budget').fill('1100');
    await expect(async () => {
      await dialog.getByRole('button', { name: 'Find best combination' }).click();
      await expect(dialog.getByText('S$' + both.toFixed(2)).first()).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20000 });
    await expect(dialog.getByText('S$' + (1100 - both).toFixed(2) + ' left of S$1100.00')).toBeVisible();

    // A smaller budget cannot hold both, so the total drops under it.
    await dialog.getByLabel('Your budget').fill('500');
    await dialog.getByRole('button', { name: 'Find best combination' }).click();
    await expect(dialog.getByText('left of S$500.00')).toBeVisible();
    const total = await dialog.getByText(/^Total S\$/).textContent();
    expect(Number((total || '').replace(/[^0-9.]/g, ''))).toBeLessThanOrEqual(500);

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
    await page.getByRole('button', { name: new RegExp('friends? saved ' + literal(SONY.name) + '\\. Buy together') }).click();

    const dialog = page.getByRole('dialog', { name: 'Buy together' });
    await expect(dialog.getByRole('heading', { name: 'Buy together' })).toBeVisible();
    await expect(dialog.getByText(SONY.name)).toBeVisible();

    // ronald.s and jayden are team accounts that really saved these headphones. zoedharm did not.
    await expect(dialog.getByText('ronald.s', { exact: true })).toBeVisible();
    await expect(dialog.getByText('jayden', { exact: true })).toBeVisible();
    await expect(dialog.getByText('zoedharm', { exact: true })).toBeHidden();

    // Close without sending an invite.
    await dialog.getByRole('button', { name: /^(Cancel|Done)$/ }).click();
    await expect(dialog).toBeHidden();
  });
});
