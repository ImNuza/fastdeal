# Freeze UI plan (31 Oct 2026)

Sources: Dewa's review, Marvel's talk (31 Oct, with Zoe and Dewa), and Ryan Lee's feedback on Telegram.
Feature freeze: Sun 1 Nov, 23:59. Dewa builds this as group leader. Each part names the owner whose code it touches.
Branch: one new branch from `main`. Dewa runs git.

## Part A. One confirm pop-up for every confirm step

New component `src/components/FdConfirmDialog.vue`. It copies the Admin role pop-up markup and the
`fd-entry-backdrop` and `fd-entry-dialog` styles in `src/assets/app.css`.

- Props: `title`, `confirmLabel`, `danger` (red confirm button), `busy`, `error`.
- Default slot: the message.
- Emits `confirm` and `cancel`. Esc and a click on the backdrop emit `cancel`.

| Place | Now | After | Owner |
|---|---|---|---|
| Friends: remove a friend | Inline "Yes, remove / Cancel" in the row | Pop-up | Marvel |
| Wishlist: remove an item | Deletes at once | Pop-up | Marvel, Zoe |
| Plan a budget: delete a saved budget | Deletes at once | Pop-up | Zoe |
| Admin: promote or demote | Own inline pop-up | Optional: use the component | Zoe |

## Part B. Wishlist row fixes

File: `src/views/WishlistView.vue`. Owner: Zoe (UI), Marvel (wishlist).

1. Icon overlap. The action column is `5rem`. Three buttons (friends, moon, trash) need `7.75rem`.
   The group spills left and covers the "Target reached" tick. Fix: make the column `7.75rem`.
2. "Sent!" moves the friends icon up (Marvel). `.fd-friends-wrap` stacks the button above "Sent!".
   Fix: keep the button in line with the moon and trash buttons. Put "Sent!" in absolute position below it.
3. "View purchase verdict" link (Marvel). Move it from under the icons into the product column.
   The CSS for that place still exists (`.fd-wish-cell-product .fd-verdict-link`).

Check at about 1000px, 1280px and full width. Below 992px the row stacks.

## Part C. Home

File: `src/views/HomeView.vue`. Owner: Zoe.

1. "Why shop with FastDeal" cards light up on hover but are not links (Marvel). Remove the hover style.
2. Trending This Week cards with no image (Ryan). Cause: seeded `searchLogs` rows have no image, and
   `topSince` in `server.js` takes the image of the newest row (`$first`). Sony WH-1000XM5 has 5 rows and 0 images.
   - Server: pick a non-empty image for the group (`$max` instead of `$first`).
   - Page: when there is no image, or the image fails to load, show a letter tile like the wishlist ("SW").
   - The same fallback goes on the Trending Today belt and the Trending page if they use the same image field.

## Part D. Compare page: price history at the top

File: `src/views/CompareView.vue`. Owner: Dewa (D5 price history), Ronald (verdict), Bernard (filters).

New order:
1. Title and "N listings. Cheapest now is ...".
2. Price history card. It replaces the yellow banner.
   - 2 or more days: bar chart, date range and low price. With 3 or more days, the verdict sits next to
     the chart on desktop and below it on a phone.
   - Exactly 2 days: chart, then "The verdict appears after 3 days of prices."
   - Fewer than 2 days: no chart. One grey line: "Price history is still being tracked for this product.
     The chart and the verdict appear after a few days of searches."
3. Filters and listings.
4. "Customers who viewed this also viewed" stays at the bottom.

Caption fix: the chart only draws days with a price. Say "one bar for each day with a tracked price",
not "last 14 days".

## Part E. Product page (Ryan)

File: `src/views/ProductView.vue`, `services/productService.js`. Owner: Ronald.

1. Worth it verdict as a main feature. Today it hides behind a secondary "Show the Worth it verdict" button.
   The page already fetches the verdict on load, so showing it costs no extra call.
   Show the verdict card open by default, near the price, with the elapsed-time loader kept.
   Remove the toggle. Update the product test (it clicks the toggle).
2. Store logos in "All stores". `toStore` in `services/productService.js` drops all SerpApi image fields.
   SerpApi's immersive product store rows should have a `logo` field. Confirm it with one saved response
   before building. Keep `logo` in `toStore`. Show it in the table with a letter tile fallback,
   because cached products have no logo until they refresh.

## Part F. AI improvements (needs Ronald's OK, he changed worth-it today)

File: `models/worth-it-model.js`, `server.js`, `src/services/productApi.js`.

1. Ground the verdict in data that every product page has, even for a niche product nobody searched before.
   Today Gemini gets only the name and the price, so it guesses ("plushies drop during 11.11").
   Always send, from the live SerpApi store list on the page:
   - the cheapest total and its store,
   - the typical price (median of the live stores, `typicalPrice` in `services/dealCheck.js`),
   - the number of stores and the gap from cheapest to priciest,
   - which stores show a "was" price (`oldPrice`), so the item is already on sale there,
   - the mean rating and review count.
   Always send, from `data/sale-calendar.js`: the next big sale and the days until it.
   Send only when it exists: the 14-day low and average from `priceDays` (3 or more days).
   Show a "Based on" line under the verdict with the numbers that were sent.
2. Cache each verdict for one day, keyed by product and price, like `searchCache`. A reload gives the same
   answer, and the demo does not wait on Gemini again.
3. Ask Gemini for JSON with `responseMimeType: 'application/json'` and a schema, so fewer verdicts fall
   back to "unclear".
4. Fix the stale model comment at the top of `models/worth-it-model.js`.
5. New page: "How this verdict was made". A button under the verdict card ("See what the AI read")
   opens a new route, `/product/:productId/worth-it`. The page shows:
   - the verdict (decision, headline, reason), the model name and the time it was made,
   - a table of every input sent to Gemini, with its value and where it came from
     (live SerpApi stores, sale calendar, FastDeal price history),
   - the inputs that were not available ("Price history: fewer than 3 days, not sent"),
   - what the AI does not read (review text, other countries, prices outside the live store list),
   - the exact prompt text, in a section that opens on click.
   The server returns `inputs` and `prompt` with the verdict. Item 2 (cache) makes the new page free:
   it reads the cached verdict and does not call Gemini again.
   Test: open the page from the product page with mocked `/api/product` and `/api/worth-it`, and check
   the inputs table and the prompt.

## Part G. Remove seed data and old accounts (Marvel)

Marvel asks: delete the seed data and the unused accounts, and use real SerpApi data for everything.
Owner: Dewa (database). This deletes rows in Atlas, so it runs only after Dewa approves the list.

Step 1. Back up every row that will be deleted to
`/Users/dewa/Documents/agents/mycwd/2026-10-31-fastdeal-cleanup/` (JSON per collection).

Step 2. Delete the seed data:
- Users `seed-friend-1` to `seed-friend-3` (alex.tan, priya_k, marcus.lim), with their wishlist items,
  friendships and notifications.
- The demo account's seeded wishlist (Sony WH-1000XM5 and Kindle Paperwhite, "Store not recorded"),
  sleep holds, friendships and notifications.
- 18 seed `searchLogs` rows (`sessionId` starts with `seed-`). This also fixes the blank Trending images.
- 728 seed `priceDays` rows (no `source`). The app already hides them.

Step 3. Delete old accounts (Dewa ticks the list):
- No username: marvelnightingale@gmail.com, nusasatya513@gmail.com, zoe.dharmadi@gmail.com.
  Safe: `POST /api/users` makes the row again on the next login, and the user sets a username.
- Test accounts: test (test2@gmail.com), dummy1, marveltest (3 wishlist items).
- Keep: each member's main account, `demo@smu.edu.sg` and `demo.user@smu.edu.sg`.
- Firebase Auth keeps its accounts. Only the Mongo rows go.

Step 4. Keep `npm run seed`, but make it use only real accounts and real SerpApi data.
The prof must still see every use case after logging in as demo, so the demo account must not be empty.
- Products: a new file `data/demo-products.json` with 4 or 5 real products copied from `productCache`
  (real productId, title, image, cheapest store, price and link). Examples in the cache today:
  Sony WH-1000XM5 (13 stores), Pokemon Pyokopunyu Pikachu (11 stores), KEF LS50 Meta (6 stores),
  Apple iPhone 16 (7 stores). No made-up prices and no "Store not recorded".
- Wishlist: demo saves these products from their real cheapest store. One has a target price,
  one is on Sleep on it.
- Friends: demo and demo.user are friends. Both saved one same product, so Buy Together shows.
- Notifications: made from the real saved products and real prices.
- No fake people, no fake search logs and no fake price history.

Use cases the prof can still see as demo: wishlist, price drop, target alert, Sleep on it, purchase verdict,
Plan a budget, friends, Buy Together, notifications, admin.
A friend request from a third person is not seeded. The friends test that sends a request between
demo and demo.user shows that flow live.

Tests that use seed data and must change:
- `tests/friends.spec.js`: alex.tan search and the marcus.lim request. Use demouser instead.
- `tests/wishlist.spec.js`: the Sony and Kindle price drop test. Use the new demo products, with
  mocked live prices.
- `tests/notifications.spec.js` uses a fixture, so it does not change.
- AGENTS.md and `docs/test-plan.md`: say what `npm run seed` does now.

## Part H. SerpApi key fallback

The app reads one `SERPAPI_API_KEY` in `models/shoppingapimodel.js` and `services/productService.js`.
Today a used-up key means a manual swap in `.env` and the Render dashboard.
Plan: add `SERPAPI_API_KEY_2` and `SERPAPI_API_KEY_3` in `.env` and in the Render dashboard.
The server makes a list of the keys that are set. When SerpApi says a key ran out of searches,
the server tries the next key for that call and remembers it until the server restarts.
A key that is not set is skipped, so the app works with one key too.
One small shared helper serves both callers (`models/shoppingapimodel.js` and `services/productService.js`).
Photo search uses Gemini, not SerpApi, so it does not change.
Graders use the app until Week 18, when nobody watches the quota.

## Tests

- `tests/wishlist.spec.js` and `tests/friends.spec.js`: click the pop-up confirm after each Remove.
- New: Cancel keeps the item. Confirm removes it. Esc closes the pop-up.
- New compare tests with a mocked `/api/price-history`: chart above the listings, and the one-line empty state.
- `tests/product.spec.js`: the verdict shows without a click. A store logo or letter tile shows.
- `tests/home.spec.js`: a trending card with no image shows the letter tile.
- Unit test for the grounded prompt builder if Part F goes in.

## Done means

- `npm run build`, `npm run test:unit` and `npm run test:e2e` pass after `npm run seed`.
- Each part checked in the browser at desktop and phone width, with screenshots.
- A Telegram note in STE style that names every changed file and its owner.

## Not in this plan

- Two verdicts (compare page rule verdict and product page AI verdict): ask at Tuesday's consult.
- SerpApi keys: Dewa adds new keys to `.env` and the Render dashboard.
