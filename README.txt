FastDeal (IS216 G8 Team 3)

FastDeal compares prices for one product across many Singapore online stores, tells you if now is a
good time to buy, and helps you wait for a better price.

Live app:  https://fastdeal-iqzg.onrender.com
Git repo:  https://github.com/ImNuza/fastdeal (public)
Video:     [YouTube link to be added]

The live app runs on a paid Render plan, so it is always on. Please use the live app: it has every
key set up. Section 3 shows how to run it on your own computer.


0. Start here (for graders)
---------------------------
1. Open https://fastdeal-iqzg.onrender.com
2. Log in with the presentation account in section 1.
3. Type one of these 7 demo searches in the search bar. Only these have a 30-day price history:
     Apple iPhone 16 Pro
     Sony WH-1000XM5 wireless headphones
     Owala bottle
     Dyson V15 Detect
     Nespresso Capsules 50 Pack
     Kindle Paperwhite
     Samsung Galaxy S25 Ultra
4. On Compare, see the price history chart above the listings. Then open a listing.
5. On the product page, see the AI "Worth it?" verdict and the store price bars under it.
6. Save the product, then open Wishlist. The empty target box shows the AI's suggested target price.
7. Any other search works too. It is live, so it shows today's prices with no history.


1. Logins
---------
Presentation account (use this one to try the app):
- Email:     fastdealdemo1@gmail.com
- Password:  123456789!abc
- Username:  fastdealdemo. Normal user. Has 5 saved products and the 6 team members as friends.
  Zoe saved the Sony WH-1000XM5 headphones. Search "Sony WH-1000XM5 wireless headphones", save the cheapest
  listing, and start Sleep on it: when it ends, a "Buy together?" alert names Zoe.
  The account has no Telegram username, so Send Invites first asks you to set one in Account.

Two more demo accounts. Both use the password demo1234.

- demo@smu.edu.sg       Admin. Has a wishlist, friends, a friend request, notifications and the
                        Admin dashboard.
- demo.user@smu.edu.sg  Normal user. Starts empty. The automated tests use it.

npm run seed resets all three accounts.

You can also create your own account on the Sign up page, or log in with Google.


2. What to try
--------------
Logged out:
- Home (/): search a product by name, or press the camera icon to search with a photo (AI finds the
  product, photos up to 8 MB). Trending Today and Trending This Week show what people search.
- Compare (/compare?q=...): every listing for the search, with filters (price, store, rating) and
  sort. A demo search also shows its 30-day price history chart. "Customers who viewed this also
  viewed" shows other products that shoppers searched with this one.
- Product page: the same listings as Compare, cheapest first, with the one you clicked as
  "Your pick", and the AI "Worth it?" verdict on your pick. "How the prices look" shows one bar per
  store, so you see where your pick sits. "See how the AI decided" opens a pop-up with the steps
  behind the verdict and the numbers it used.
  If both Gemini models are busy, the card shows an estimate from fixed rules and says so.
- Trending (/trending): the most searched products.

Logged in as demo@smu.edu.sg:
- Wishlist (/wishlist): saved products with the best price now, price drops, a target price alert
  per product (with an AI suggested target, and an email when the price reaches it), Sleep on it
  (lock a product for a while before you buy), and Plan a budget.
- Friends (/friends): friends, add friend, requests. Buy Together shows when a friend saved the
  same product, so you can split the shipping.
- Notifications (/notifications): price drops, target price reached, sale reminders, friends.
- Admin (/admin): usage numbers and user roles.


3. Set up and run on your own computer
--------------------------------------
Needs Node.js 18 or newer and npm.

1. Unzip the submitted file, or clone the repo:
     git clone https://github.com/ImNuza/fastdeal.git
     cd fastdeal
2. Make the .env file.
   - The submitted zip has our .env file with working keys. Use it as it is.
   - From the Git repo, copy .env.example to .env and fill in every value. The keys are not in Git.
3. Install:
     npm install
4. Put the demo data in the database (safe to run again):
     npm run seed
5. Build the pages and start the server:
     npm run build
     npm start
6. Open http://localhost:3000 . The home page is the first page.
   Health check: http://localhost:3000/health

For development, run npm start in one terminal and npm run dev in another, then open
http://localhost:5173 . Vite reloads the page when a file changes, and sends /api calls to port 3000.

If npm start stops at once, it could not reach MongoDB. Check MONGODB_URI in .env, and turn off any
VPN. 

5. Environment variables
------------------------
- MONGODB_URI            MongoDB Atlas connection string, database "fastdeal".
- SERPAPI_API_KEY        SerpApi key (Google Shopping, Google product pages).
- SERPAPI_API_KEY_2 to _10  Optional backup keys. When one key runs out of searches, the server
                         uses the next one. A key that is not set is skipped.
- GEMINI_API_KEY         Google Gemini key (search clean-up, photo search, Worth it verdict).
- GEMINI_API_KEY_2 to _10  Optional backup keys. When a Gemini call fails with one key, the server
                         tries the next one. A key that is not set is skipped.
- VITE_FIREBASE_*        Firebase Authentication settings for the browser. Not secret.
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
                         Email for target price alerts. Optional: without them, no email is sent.
- DEMO_FIREBASE_UID, DEMO_USER_FIREBASE_UID
                         Firebase user ids of the two demo accounts. Only npm run seed uses them.
- E2E_DEMO_PASSWORD      demo1234. Only the Playwright tests use it.


6. External APIs
----------------
- SerpApi Google Shopping: the search results on Compare.
- SerpApi Google Immersive Product: the photo, rating, buyer reviews and description on the
  product page. Its store list is not shown: the product page lists the Compare listings.
- Google Gemini: cleans up the search words, identifies a product from a photo, and writes the
  "Worth it?" verdict.
- Firebase Authentication: sign up and login (email and Google).
- MongoDB Atlas: all app data.

Free plan limits: SerpApi gives 250 searches a month per key. To save searches, the server keeps
each search for 6 hours and each product page for 24 hours, and a repeat uses no search.
Each AI verdict is kept for the rest of the day.

6a. Demo searches and price history
-----------------------------------
SerpApi gives no price history. So FastDeal has 7 demo searches whose listings have a 30-day price
history. Type one of these in the search bar (case and extra spaces do not matter):
  Apple iPhone 16 Pro
  Sony WH-1000XM5 wireless headphones
  Owala bottle
  Dyson V15 Detect
  Nespresso Capsules 50 Pack
  Kindle Paperwhite
  Samsung Galaxy S25 Ultra
- The searches and their product pages are real SerpApi results, saved once by
  node data/capture-demo.js into data/demo-searches.json. npm run seed puts them in the cache with
  demo: true, so they never call SerpApi again. Their prices are from the capture day.
- The 30-day history is made up: npm run seed writes 30 days for each listing in these searches and
  each demo wishlist product, ending at the real captured price. The rows have source "seed".
- Limitation: the history always ends on the capture day, 3 Nov 2026 (5 Oct to 3 Nov). The dates
  do not move, so after 3 Nov the chart shows no newer days, and its label reads "Lowest price on
  3 Nov". This is on purpose: we did not want to show made-up prices for days we never checked.
  You do not need to run npm run seed for this. The rows are in the database and do not expire.
- Any other search is live, and its products have no history.

6b. Libraries
-------------
All are free and open source. We did not copy code from other projects.
In the browser:
- Vue 3, Vue Router, Pinia: the pages, the page routes and the shared state.
- Bootstrap 5.3.3 (CDN): layout, grid and components. Google Fonts: Anton and DM Sans.
- axios: calls to our own /api routes.
- Firebase (JS SDK): sign up and login.
- Chart.js: the store price bars on the product page.
On the server:
- Express: the web server and the /api routes.
- Mongoose: the MongoDB models.
- firebase-admin: checks the login token on each request.
- serpapi: the SerpApi client.
- multer: reads the uploaded photo for photo search.
- nodemailer: sends the target price email.
- dotenv: reads .env.
For building and tests:
- Vite and @vitejs/plugin-vue: build the Vue app.
- Vitest, @vue/test-utils and jsdom: unit and component tests.
- Playwright: end-to-end tests.


7. Tests
--------
Three levels of tests: unit, component and end-to-end, 226 tests in total. None of them calls
SerpApi or Gemini: the tests use saved responses from tests/fixtures/ or the demo searches that
npm run seed saves.

Unit and component tests (Vitest), 138 tests in 19 files, in the __tests__ folders:
  npm run test:unit
- Unit tests (119 tests, 15 files) test the pure logic: the typical price, the store price rows,
  the budget planner, the AI verdict inputs, prompt and rule fallback, the AI suggested target,
  the price the target alert checks, the seeded price history and its 30-day window, the SerpApi
  and Gemini key fallbacks, keys, formats and search history.
- Component tests (19 tests, 4 files in src/components/__tests__) mount one Vue component with
  @vue/test-utils, click it and check what it shows and emits: the confirm pop-up, the page
  buttons, the list search box and the price history label.

End-to-end tests (Playwright), 88 tests in 15 files, in tests/:
1. Once, install the browser:
     npx playwright install chromium
2. Put E2E_DEMO_PASSWORD=demo1234 in .env.
3. Reset the demo data:
     npm run seed
4. Run all tests. This starts the server and Vite by itself, logs in both demo accounts once,
   and runs the tests:
     npm run test:e2e
5. Open the HTML report:
     npm run test:report
   To watch each step in a window:  npx playwright test --ui

What the E2E tests cover:
- smoke.spec.js: home page, search, login redirect, admin access and the 403 page
- auth.spec.js: login and sign-up form messages, login back to the page you wanted, log out
- navbar.spec.js: the links for each kind of user, the phone menu and the phone search
- compare.spec.js: the cheapest badge, page buttons, store filter, sort, no-match message, the
  price history chart, a real demo search from Home to the product page, recent searches
- trending.spec.js, home.spec.js: Trending lists, links to Compare, photo fallback
- product.spec.js: the product page, the AI verdict, and the "See how the AI decided" pop-up
- wishlist.spec.js: save and remove, search, sort, tabs, Sleep on it, Plan a budget (plan, save,
  open again and delete), Buy Together (open, send an invite, a failed invite), the remove pop-up
- target-price-alert.spec.js: set and change a target price
- friends.spec.js: friend list search, the remove pop-up, and requests between the two demo
  accounts: send, accept, decline and remove a friend
- notifications.spec.js: tabs, search, mark as read, an expired Buy Together invite
- admin.spec.js: insights for 7 and 30 days, user search, the Admins tab, Promote and Demote
- account.spec.js: account settings
- errors.spec.js: the 404 page and the server error page
- api-security.spec.js: requests sent straight to the API with Playwright's request fixture.
  Every route that needs a login refuses a request without one, a made-up token is refused, a
  normal user cannot read the admin data or make themselves an admin, and an admin cannot change
  their own role.

Not tested end to end, on purpose: a real sign-up and Google sign-in (tests must not create
users), photo search and the live AI answers (they call Gemini), live searches (they call
SerpApi), and the price alert emails (they send real email). The logic behind the AI verdict,
the target price check and the price history has unit tests.

The tests are repeatable: every test that changes data puts it back, and npm run seed resets the
demo accounts. A test tagged @admin runs as demo@smu.edu.sg, a test tagged @user runs as
demo.user@smu.edu.sg, and the rest run logged out.


8. Project layout
-----------------
- server.js            Express server: every /api route, and it serves the built pages from dist/.
- models/              MongoDB models (one file per collection) and the SerpApi + Gemini search.
- services/            Server logic: product pages, typical price, store price rows, AI verdict inputs,
                       email, SerpApi keys.
- src/                 Vue 3 app: views/ (pages), components/, store/ (Pinia), services/, router/.
- data/                seed.js, demo-products.json (real products team members saved) and the
                       sale calendar.
- tests/               Playwright tests and fixtures.
- docs/                The database ERD (also at /erd in the app), the test plan and the proposal.


9. Use of AI / LLM
------------------
1. Help debug codes when there are errors or provide hints if we can't solve a problem
2. Generate the boilerplate for this project
3. Help us settle merge conflicts
4. Helps us learn new libraries such as chart.js or firebase
5. Shared AI guidelines (AGENTS.md and DESIGN.md): 
   to stop AI from guessing or Hallucinating giving the AI the project 
   context and rules. Every team member’s AI tool reads the same files, 
   so everyone gets consistent answers.