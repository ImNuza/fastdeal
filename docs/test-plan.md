# FastDeal test plan

Written 2026-10-29. Status: plan only. No test code exists yet.

## Why now

- Rubric minimum requirement: "At least end-to-end testing of the core features."
- Testing is 10% of the final mark (2 marks). The top band asks for tests that cover the main user journeys, are repeatable, use stable selectors and have a clear structure.
- The presentation must "describe how the features are tested". The video shows the tests running.
- Dates: feature freeze Sun 1 Nov 23:59. Video recorded by Wed 4 Nov. Final zip due Fri 6 Nov, 9am.
- Today `package.json` has no test script, no Playwright and no Vitest. `src/` has 0 `data-testid` attributes.

## Tools

Follow the Week 10 course material. Do not add other tools.

| Kind | Tool | Course source | Use in FastDeal |
|---|---|---|---|
| End-to-end | Playwright | Week 10c, `Week 10/resource/Ex3 (e2e Testing)` | Main test type. One or two journeys per core feature. |
| Unit | Vitest | Week 10a and 10b, `Ex1`, `Ex2` | Optional. Only for small pure functions, for example `models/product-key.js` and `models/pair-key.js`. |

Package manager: the course uses `pnpm create playwright`. FastDeal uses npm (Render runs `npm install`). Use `npm init playwright@latest` with the same answers as the course (JavaScript, `tests` folder, no GitHub Actions, install browsers).

## Setup (Dewa, before the freeze)

1. Install Playwright with the course answers. Commit `playwright.config.js` and the `tests/` folder.
2. Start from the course `playwright.config.js` and change only these lines:
   - `use.baseURL: 'http://localhost:5173'`
   - `webServer`: two entries, `npm run start` (API on port 3000) and `npm run dev` (Vite on 5173), with `reuseExistingServer: true`.
   - `projects`: Chromium only. Three browsers triple the run time and give no extra marks.
   - Keep `reporter: 'html'`. The video shows this report.
3. Add the scripts to `package.json`:
   - `"test:e2e": "playwright test"`
   - `"test:report": "playwright show-report"`
4. Add these lines to `.gitignore`: `playwright-report/`, `test-results/`, `playwright/.auth/`.

### Search and Gemini: no live calls

Every live search uses SerpApi (250 searches a month for the whole team, also used by the graders until Week 18). A live result also changes from day to day, so the test is not repeatable.

- Save one real `/api/search?q=iphone 16` response as `tests/fixtures/search-iphone.json`.
- In each test that searches, return the fixture with `page.route('**/api/search*', ...)`.
- Do the same for `/api/identify-image` (Gemini), with `tests/fixtures/identify-image.json`.
- Other API routes (wishlist, friends, notifications) go to the real local server.

### Login: the seeded demo account

- Use `demo@smu.edu.sg`. `npm run seed` already creates its wishlist, friends and sleep holds, and resets them each time it runs.
- The demo login is not a secret. It goes in README.txt for the graders. The tests read it from `E2E_DEMO_PASSWORD` in `.env`, so a changed password needs no code change.
- Add a `setup` project that logs in once through the login page and saves the session to `playwright/.auth/demo.json`. Firebase keeps the session in IndexedDB, so call `storageState({ path, indexedDB: true })` (Playwright 1.51 or later).
- Tests that need a login use that file. Login tests start with no saved session.

### Database

- Local runs write to the same `fastdeal` database that Render uses.
- Run `npm run seed` before each full test run. It resets only the demo account and the three seed friends.
- Tests must not create new users. Signup tests check the form errors only. They do not submit a new account.

### Selectors

The rubric asks for stable selectors. Use them in this order:

1. `getByRole` with the visible name, for example `getByRole('button', { name: 'Sleep on it' })`.
2. `getByLabel` for form fields.
3. `data-testid` only when 1 and 2 do not work. Format: `feature-element`, for example `data-testid="wishlist-item"`. The owner of the feature adds it in their own component.

Never use CSS classes or `nth-child`. Classes change when someone restyles a page.

### Files

```
tests/
  auth.setup.js          login once, save the session
  fixtures/              saved API responses
  smoke.spec.js          Dewa
  search.spec.js         Bernard
  auth.spec.js           Marvel
  wishlist.spec.js       Marvel
  buy-together.spec.js   Marvel
  alerts.spec.js         Jayden
  compare.spec.js        Ronald
  sleep.spec.js          Zoe
  friends.spec.js        Zoe
  product.spec.js        Dewa
```

Each file has one `test.describe` block named after the feature. Each test name is a sentence that says what the user can do, for example `test('user can add a product to the wishlist', ...)`.

## Tests

Owners come from the proposal "Who do what?" table. Each owner writes the tests for their own feature, as agreed in the 26 Oct meeting.

### Before the freeze (Dewa, by Sat 31 Oct)

These parts are stable now. They also act as the template for the others.

| File | Test |
|---|---|
| `smoke.spec.js` | Home page loads and shows the search box |
| `smoke.spec.js` | A search shows result cards (fixture) |
| `smoke.spec.js` | A logged-out user who opens `/wishlist` goes to `/login` |
| `smoke.spec.js` | The admin demo account can open the admin dashboard |
| `smoke.spec.js` | The normal demo account who opens `/admin` gets "Access denied" |
| `product.spec.js` | Product page shows the name, the lowest price and the store table. The price history chart is on Compare, so Ronald tests it in `compare.spec.js`. |

Status 2026-10-29: done on branch `test/playwright-setup`. 4 logged-out tests pass. `auth.setup.js` and the two admin tests need a login, so Dewa runs them with `npm run test:e2e`.

### Rules every spec follows (learned from the setup)

- A test that needs a login has `@admin` (runs as demo@smu.edu.sg) or `@user` (runs as demo.user@smu.edu.sg) in its title. `auth.setup.js` logs in both accounts first. An untagged test runs logged out.
- First-time guests see a welcome dialog. Add this `beforeEach` to every spec: `page.addInitScript(() => sessionStorage.setItem('fastdeal-entry-choice', 'guest'))`.
- The search box is found by `getByLabel('Product name')`. A search goes to `/compare?q=...`.
- The login fields have placeholders but no labels, so `auth.setup.js` uses `getByPlaceholder`. Marvel can add labels to the login form. Then update `auth.setup.js`.
- Copy `tests/smoke.spec.js` as the template.

### After the freeze (each owner, Mon 2 Nov to Tue 3 Nov)

| Owner | File | Tests |
|---|---|---|
| Bernard | `search.spec.js` | Search, then filter and sort the results. Image search shows a result (fixture). Trending page lists searches. |
| Marvel | `auth.spec.js` | Login with the demo account works. Wrong password shows an error. Signup form shows errors for bad input. |
| Marvel | `wishlist.spec.js` | Add a product to the wishlist, see it on `/wishlist`, remove it. |
| Marvel | `buy-together.spec.js` | Send a Buy Together invite to a seed friend. The invite shows as sent. |
| Jayden | `alerts.spec.js` | Set a target price on a wishlist item. The value stays after a reload. The email itself cannot be tested end to end. If the 10% drop rule is a pure function, add one Vitest unit test for it. |
| Ronald | `compare.spec.js` | Compare page lists store offers from lowest to highest price. The "Worth it?" verdict shows. Write these only after the verdict exists and Compare no longer uses mock data. |
| Zoe | `sleep.spec.js` | Start "Sleep on it" on a product. The countdown shows on the wishlist item. |
| Zoe | `friends.spec.js` | Search for a seed friend, send a request, see it under sent requests. Notifications page marks one as read. |

Target: about 15 to 20 tests, all green in one run.

## Timeline

| Date | Work | Owner |
|---|---|---|
| Thu 29 Oct to Sat 31 Oct | Setup, fixtures, login setup, smoke and product tests | Dewa |
| Sat 31 Oct | Message the group: how to run the tests, the selector rules, one example test | Dewa |
| Sun 1 Nov 23:59 | Feature freeze | All |
| Mon 2 Nov to Tue 3 Nov | Each owner writes and passes their tests | All |
| Tue 3 Nov night | One full run, all green, HTML report saved | Dewa |
| Wed 4 Nov | Video: run `npm run test:e2e`, open the report | Test owner |
| By Thu 5 Nov | README.txt: how to run the tests | README owner |

## Dependencies on other members

- Ronald: the Compare tests wait for real data on Compare and for the Gemini verdict.
- Zoe: the search bar is moving to the top of the page. Smoke tests find it by role (`searchbox`), so the move does not break them. Zoe must keep it as an `<input type="search">` or give it a label.
- Marvel: login tests depend on the login page labels. If he changes them, he updates `auth.setup.js`.
- Bernard: the search fixture must match the response shape his search code reads. If he changes that shape, he saves a new fixture.
- Dewa: the rate limit on the `delete-mock` branch is not on main. If it merges, check that a full test run does not hit the limit on localhost.

## What Dewa must do first

1. Put the demo password in `.env` as `E2E_DEMO_PASSWORD`.
2. Agree on the file and selector rules in the group chat before the freeze.
3. Say "go" to start the setup. No test code is written before that.

## When testing is complete

1. Setup and smoke tests are on main (Dewa).
2. Every owner's tests are on main. Ronald's Compare tests are last, because they wait for the verdict.
3. After `npm run seed`, `npm run test:e2e` passes three runs in a row with no retries. This proves the tests are repeatable.
4. Team rule: run `npm run build` and `npm run test:e2e` before a merge to main.
5. README.txt says how to install the browsers and run the tests, and gives the demo login.
6. The video shows a test run and the HTML report. One slide says what each test covers.
7. Fwa confirms the approach at the Week 12 consultation, or the plan changes to match his answer.

## Questions for Fwa (Week 12 consultation)

- Are Playwright E2E tests for each core journey, plus a few Vitest unit tests, enough for the top testing band?
- Is it fine for tests to replace the live SerpApi and Gemini responses with saved responses?
