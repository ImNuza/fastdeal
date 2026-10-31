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
| Unit | Vitest | Week 10a and 10b, `Ex1`, `Ex2` | Added 2026-10-31. Pure functions with many edge cases. See "Unit tests (Vitest)". |

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

### Change 2026-10-31: Dewa writes the remaining tests

Dewa writes all remaining tests, so nobody waits on another member. Done so far: the smoke tests (Dewa) and `target-price-alert.spec.js` (Jayden, 2 tests).

Not written now:
- Search filters and sort, login and signup errors: left out on purpose.
- Product page, wishlist, Sleep on it, plan a budget: Zoe is still changing these pages. Write their tests after her PR merges. Then also check `product.spec.js` and `target-price-alert.spec.js`, which may break.

Next batch, branch `test/trending-friends-notifications-admin`: 12 tests in 6 files, about 450 lines. Pages Zoe confirmed as finished on 31 Oct: home, friends, notifications, admin, account. Trending is stable.

| # | File | Login | Test |
|---|---|---|---|
| 1 | `trending.spec.js` | none | The "Trending" table shows at least one row. |
| 2 | `trending.spec.js` | none | A row's "Compare" link opens `/compare?q=...`. `/api/search` returns the fixture. |
| 3 | `home.spec.js` | none | "Trending Today" and "Trending This Week" show items. |
| 4 | `friends.spec.js` | `@admin` | "Search your friends" finds the team account `zoedharm` (a seed friend). Nonsense input shows "No friends match". |
| 5 | `friends.spec.js` | `@admin` | The "Requests" tab shows the seed request from the team account `dewa`. |
| 6 | `friends.spec.js` | `@user` | `demo.user` sends a request to `demo` from "Add Friend". In a second context with `playwright/.auth/admin.json`, `demo` sees it under "Requests" and in the "Friends" tab on Notifications. Cleanup: `demo.user` cancels the request. |
| 7 | `notifications.spec.js` | `@admin` | Tabs filter: "Wishlist" shows the price drop and sale notices, "Friends" shows the friend request. `/api/notifications` returns a 3-item fixture, because the seed no longer creates notifications. |
| 8 | `notifications.spec.js` | `@admin` | "Search notifications" narrows the list. "Dismiss" removes the unread dot. "Show: Unread only" hides it. The read endpoints are mocked. |
| 9 | `admin.spec.js` | `@admin` | "Last 30 days" becomes pressed and the cards say "Compared to previous 30 days". |
| 10 | `admin.spec.js` | `@admin` | "Search users by username or email" with `demouser` shows `demo.user@smu.edu.sg`. Never click Promote or Demote. |
| 11 | `account.spec.js` | `@user` | The Telegram username saves and stays after a reload. The test puts the old value back. |
| 12 | `account.spec.js` | `@user` | The email alerts checkbox stays after a reload. The test puts the old value back. |

After this batch: 20 tests plus 2 login steps.

Checked 2026-10-31 after Zoe's PRs #35 (wishlist, Buy Together, budget UI, new `FdScrollArea` component) and #36 (Buy Together popup): every label and text tests 1 to 12 use still exists. Logged-out tests still pass.

Batch 3, now unblocked (Zoe's wishlist is merged): 5 E2E tests in `wishlist.spec.js`. Every test routes `**/api/search*` to the fixture, because the wishlist checks a live price for each item.

| # | Login | Test |
|---|---|---|
| 13 | `@user` | On a product page (product fixture), "Save" adds the product. It shows on `/wishlist`. "Remove <name>", then "Remove" in the pop-up, takes it off again. |
| 14 | `@admin` | "Search your wishlist" narrows the list. "Sort by" changes the order. The tabs "Price drops" and "Sleeping on it" filter the list. Read only. |
| 15 | `@user` | Save a product, then "Sleep on <name>" with a hold time. It shows under "Sleeping on it". Cleanup: remove the product. |
| 16 | `@admin` | "Plan a budget" tab, "New budget": enter "Your budget". The plan keeps the total under the budget. Close without saving. If a save is tested, delete the draft with "Delete <name>" at the end. |
| 17 | `@admin` | The "friends saved ... Buy together" button opens the "Buy together" dialog with the team accounts that saved the same Sony headphones (ronald.s, jayden). Close without sending. |

Added 2026-10-31 after Zoe's PR #38 (error pages): `tests/errors.spec.js` (unknown URL shows "Page not found"; a 500 from `/api/trending` shows "Server error" with "Try again") and `src/services/__tests__/errors.spec.js` (4 unit tests for `errorInfo`). The admin access test now checks the `/error/403` page instead of an alert.

Ronald's AI verdict landed on 31 Oct (`/api/worth-it`, Gemini). `tests/fixtures/worth-it.json` is the saved verdict. `product.spec.js` and `wishlist.spec.js` route `**/api/worth-it*` to it, and `product.spec.js` tests the Show/Hide verdict panel.

Batch 5 (31 Oct, freeze UI plan in `docs/freeze-ui-plan.md`): 7 E2E tests and 14 unit tests.
The seed now uses real data only (`data/demo-products.json` and the team accounts), so tests 4, 5, 14, 16 and 17 read those names.

| # | File | Login | Test |
|---|---|---|---|
| 18 | `friends.spec.js` | `@admin` | "Remove zoedharm as a friend" opens the "Remove friend" pop-up. Cancel and Esc close it. The friend stays. |
| 19 | `wishlist.spec.js` | `@admin` | "Remove <name>" opens the "Remove from wishlist" pop-up. Cancel keeps the product. |
| 20 | `compare.spec.js` | none | Removed 31 Oct (batch 6). No price history: one line, no chart (`/api/price-history` mocked). |
| 21 | `compare.spec.js` | none | Removed 31 Oct (batch 6). 3 days of history: the chart and the verdict sit above the filters. |
| 22 | `product.spec.js` | none | The AI "Worth it?" verdict shows without a click, with its "Based on" line. |
| 23 | `product.spec.js` | none | "See what the AI read" opens `/product/:id/worth-it`: the inputs table, Sent and Not sent, and the prompt. |
| 24 | `home.spec.js` | none | A trending product with no photo shows its initials. |
| 25 | `notifications.spec.js` | `@admin` | A Buy together invite from someone who is no longer a friend says the invite expired, with no Telegram link (`/api/users/profile/*` mocked as 403). |
| 26 | `product.spec.js` | none | When the AI did not answer, the verdict card says it is an estimate from fixed rules. |

Unit: `services/__tests__/worthItInputs.spec.js` (9 tests: the inputs from live stores, the sale calendar,
history only with 3 or more days, the summary, the prompt) and `services/__tests__/serpapiKeys.spec.js`
(5 tests: the next key after "run out of searches", keys that are not set, other errors).

Batch 6 (31 Oct evening meeting): the team removed price history and the Deal check. SerpApi gives no price
history, and a product the prof searches for the first time would have none. `tests/compare.spec.js` (tests 20
and 21) is deleted. Test 23 now checks that the AI page has no Price history row (7 of 7 inputs sent).
Test 1 in `product.spec.js` also checks that the store table has no Deal check column.
`services/__tests__/dealCheck.spec.js` became `typicalPrice.spec.js` (4 tests): the AI verdict still uses the
typical price. The two price history tests in `worthItInputs.spec.js` became one test (no history row).
Totals: 34 E2E tests in 11 files, 84 unit tests in 11 files.

Batch 4, after Ronald's AI verdict merges: Compare filters and sort, the cheapest badge, the verdict (with a saved Gemini response). About 3 tests. Then check `product.spec.js` and `target-price-alert.spec.js`.

Rules for this batch:
- Only role, label and visible text selectors. Every input used here already has a label, so no `.vue` change.
- The friend request test writes one friendship and one notification to the shared database and removes the request at the end. `npm run seed` resets the rest.
- Dewa runs the `@admin` and `@user` tests (Firebase login). The agent runs only the logged-out tests.
- Bernard reviews the finished tests and changes what he needs. He presents the testing part.

### Unit tests (Vitest), added 2026-10-31

Why: the top testing band says "Tests demonstrate excellent understanding of testing concepts". The course taught unit tests (10a), component tests (10b) and E2E tests (10c). E2E alone shows one level. Many fast unit tests under a few E2E journeys is the testing pyramid.

Setup (follows Week 10 Ex1 and Ex2):
- `npm install -D vitest jsdom` (npm, not pnpm, as for Playwright).
- `vitest.config.js` like the Ex2 one (`mergeConfig` with `vite.config.js`). `include`: `**/__tests__/**/*.spec.js`. `exclude`: `tests/**` (the Playwright folder) and `node_modules/**`. Default environment `node`. A file that needs a browser (localStorage) starts with `// @vitest-environment jsdom`.
- Script: `"test:unit": "vitest run"`. `npx vitest` runs in watch mode, as in class.
- Test files sit next to the code in `__tests__` folders, like Ex2's `src/components/__tests__`.

Rules:
- Course style, as in `SimpleFunction.spec.js`: `describe` per function, `it` per case, a few `expect` lines in each `it`.
- Only functions that are already exported. No app code changes in this batch.
- No network, database, SerpApi or Gemini. Pass a fixed date (`now`) to time-based functions. Never use the real clock.
- Test names say the rule being checked, for example "labels a price far under the typical price as much cheaper".

| # | File | Functions | About |
|---|---|---|---|
| U1 | `services/__tests__/dealCheck.spec.js` (now `typicalPrice.spec.js`, 4 tests, batch 6) | `typicalPrice`, `priceLabel`, `wasPriceLabel`, `saleSoon`, `dealCheck` | 16 tests: the median, each price label band and its edges, "too few stores", a real versus inflated "was" price, a sale inside and outside the 45-day window. |
| U2 | `services/__tests__/priceHistory.spec.js` | `sgDay`, `storePrices` | 7 tests: the Singapore day at the midnight edge, prices outside half to double the median dropped, the cheapest price per store. |
| U3 | `models/__tests__/keys.spec.js` | `toProductKey`, `toPairKey` | 8 tests: case, spaces and trim, the same key for both uid orders. |
| U4 | `src/services/__tests__/budgetPlanner.spec.js` | `planBudget` | 10 tests: the best mix fits the budget, a must have #1 beats #2 and #3 together, nothing fits, an empty list, the option limit, more than 16 items. |
| U5 | `src/services/__tests__/format.spec.js` | `sgd`, `storeLink`, `dayText` | 8 tests: money format, rounding, the store link, the day text. |
| U6 | `src/services/__tests__/itemName.spec.js` | `itemName` | 5 tests. |
| U7 | `src/services/__tests__/searchHistory.spec.js` | `readHistory`, `addToHistory`, `removeFromHistory` | 6 tests (jsdom): newest first, no duplicates, max 5, remove, empty or broken storage. |

About 60 unit tests and 500 lines. They run in about 1 second.

Later, after Ronald's AI verdict merges: move the rule part of the verdict out of `src/store/compare.js` into `src/services/verdict.js` (with Ronald's OK) and add about 10 tests for Worth It, Maybe and Not Worth It at each boundary. Total then about 70 unit tests.

Totals when everything is done: about 70 unit tests plus about 30 E2E tests.

### Old owner split (replaced by the change above)

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
