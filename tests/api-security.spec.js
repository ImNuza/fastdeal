// @ts-check
import { test, expect } from '@playwright/test';

// These tests send requests straight to the API with Playwright's request fixture, with no page.
// They check that the server itself refuses what the pages hide, so a user cannot get round a
// hidden button by calling the API.

// Routes that need a login, one test each. The admin routes need a login before the admin check.
const LOGIN_ROUTES = [
  ['GET', '/api/users/me'],
  ['PUT', '/api/users/me'],
  ['POST', '/api/users/me/budgets'],
  ['GET', '/api/wishlist'],
  ['POST', '/api/wishlist'],
  ['DELETE', '/api/wishlist/sony'],
  ['GET', '/api/friends'],
  ['POST', '/api/friends/request'],
  ['GET', '/api/notifications'],
  ['PUT', '/api/notifications/read-all'],
  ['POST', '/api/buy-together/invite'],
  ['GET', '/api/me/recent-searches'],
  ['GET', '/api/admin/stats'],
  ['GET', '/api/admin/users']
];

// The login token the page sends to the API. The page gets it from the saved session.
/** @param {import('@playwright/test').Page} page */
async function tokenOf(page) {
  const call = page.waitForRequest((req) => req.url().includes('/api/') && 'authorization' in req.headers());
  await page.goto('/account');
  return (await call).headers()['authorization'];
}

test.describe('API security', () => {
  for (const [method, path] of LOGIN_ROUTES) {
    test('server refuses ' + method + ' ' + path + ' without a login', async ({ request }) => {
      const res = await request.fetch(path, { method: method, data: method === 'GET' ? undefined : {} });

      expect(res.status()).toBe(401);
      expect((await res.json()).error).toBe('Log in first');
    });
  }

  test('server refuses a made-up login token', async ({ request }) => {
    const res = await request.get('/api/wishlist', { headers: { Authorization: 'Bearer not-a-real-token' } });

    expect(res.status()).toBe(401);
    expect((await res.json()).error).toBe('Your login has expired. Log in again.');
  });

  test('server answers the health check and serves the ERD without a login', async ({ request }) => {
    const health = await request.get('/health');
    expect(health.ok()).toBeTruthy();
    expect(await health.json()).toEqual({ ok: true });

    const erd = await request.get('/erd');
    expect(erd.ok()).toBeTruthy();
    expect(await erd.text()).toContain('wishlist');
  });

  test('server refuses the admin stats to a normal user @user', async ({ page, request }) => {
    const token = await tokenOf(page);

    const res = await request.get('/api/admin/stats', { headers: { Authorization: token } });

    expect(res.status()).toBe(403);
    expect((await res.json()).error).toBe('Admins only');
  });

  test('server refuses the user list to a normal user @user', async ({ page, request }) => {
    const token = await tokenOf(page);

    const res = await request.get('/api/admin/users', { headers: { Authorization: token } });

    expect(res.status()).toBe(403);
  });

  test('normal user cannot make themselves an admin @user', async ({ page, request }) => {
    const token = await tokenOf(page);
    const me = await (await request.get('/api/users/me', { headers: { Authorization: token } })).json();

    const res = await request.put('/api/admin/users/' + me.firebaseUid + '/role', {
      headers: { Authorization: token },
      data: { role: 'admin' }
    });
    expect(res.status()).toBe(403);

    // The role in the database did not change.
    const after = await (await request.get('/api/users/me', { headers: { Authorization: token } })).json();
    expect(after.role).toBe('user');
  });

  test('admin can read the stats and the user list @admin', async ({ page, request }) => {
    const token = await tokenOf(page);

    const stats = await request.get('/api/admin/stats?days=30', { headers: { Authorization: token } });
    expect(stats.ok()).toBeTruthy();
    const body = await stats.json();
    expect(body.daily).toHaveLength(30);

    const users = await request.get('/api/admin/users', { headers: { Authorization: token } });
    expect(users.ok()).toBeTruthy();
  });

  test('admin cannot change their own role @admin', async ({ page, request }) => {
    const token = await tokenOf(page);
    const me = await (await request.get('/api/users/me', { headers: { Authorization: token } })).json();

    const res = await request.put('/api/admin/users/' + me.firebaseUid + '/role', {
      headers: { Authorization: token },
      data: { role: 'user' }
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('Cannot change your own role');
  });

  test('server refuses a role that does not exist @admin', async ({ page, request }) => {
    const token = await tokenOf(page);

    const res = await request.put('/api/admin/users/anyone/role', {
      headers: { Authorization: token },
      data: { role: 'owner' }
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('Invalid role');
  });
});
