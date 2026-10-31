FastDeal (IS216 G8 Team 3)

FastDeal compares prices for one product across many Singapore online stores, tells you if now is a
good time to buy, and helps you wait for a better price.

Live app:  https://fastdeal-iqzg.onrender.com
Git repo:  https://github.com/ImNuza/fastdeal (public)

The live app runs on Render's free plan. It sleeps when nobody uses it, so the first page can take
up to a minute to load. After that it is fast.


1. Logins
---------
Two demo accounts. Both use the password demo1234.

- demo@smu.edu.sg       Admin. Has a wishlist, friends, a friend request, notifications and the
                        Admin dashboard.
- demo.user@smu.edu.sg  Normal user. Starts empty. The automated tests use it.

You can also create your own account on the Sign up page, or log in with Google.


2. What to try
--------------
Logged out:
- Home (/): search a product by name, or press the camera icon to search with a photo (AI finds the
  product). Trending Today and Trending This Week show what people search.
- Compare (/compare?q=...): every listing for the search, with filters (price, store, rating, free
  shipping, on sale) and sort. The Price history card shows the prices FastDeal tracked.
- Product page: every store for one product, with a Deal check per store, and the AI "Worth it?"
  verdict. "See what the AI read" opens a page with every input the AI used and the exact prompt.
  If both Gemini models are busy, the card shows an estimate from fixed rules and says so.
- Trending (/trending): the most searched products.

Logged in as demo@smu.edu.sg:
- Wishlist (/wishlist): saved products with the best price now, price drops, a target price alert
  per product, Sleep on it (lock a product for a while before you buy), and Plan a budget.
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
VPN. Atlas must allow your IP address (Network Access in Atlas).


4. Deploy (Render)
------------------
1. In Render, make a new Web Service from the Git repo.
2. Build command:  npm install && npm run build
3. Start command:  npm start
4. Add every variable from .env as an environment variable in the Render dashboard.
   Do not put keys in the repo.
5. In MongoDB Atlas, Network Access, allow 0.0.0.0/0 (Render has no fixed IP address).
6. In Firebase, Authentication, Settings, Authorized domains, add the Render domain
   (for example fastdeal-iqzg.onrender.com). Without it, login does not work on Render.
7. A push to main deploys again by itself.


5. Environment variables
------------------------
- MONGODB_URI            MongoDB Atlas connection string, database "fastdeal".
- SERPAPI_API_KEY        SerpApi key (Google Shopping, Google product pages).
- SERPAPI_API_KEY_2, _3  Optional backup keys. When one key runs out of searches, the server
                         uses the next one.
- GEMINI_API_KEY         Google Gemini key (search clean-up, photo search, Worth it verdict).
- VITE_FIREBASE_*        Firebase Authentication settings for the browser. Not secret.
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
                         Email for target price alerts. Optional: without them, no email is sent.
- DEMO_FIREBASE_UID, DEMO_USER_FIREBASE_UID
                         Firebase user ids of the two demo accounts. Only npm run seed uses them.
- E2E_DEMO_PASSWORD      demo1234. Only the Playwright tests use it.


6. External APIs
----------------
- SerpApi Google Shopping: the search results on Compare.
- SerpApi Google Immersive Product: every store for one product, with store logos and reviews.
- Google Gemini: cleans up the search words, identifies a product from a photo, and writes the
  "Worth it?" verdict.
- Firebase Authentication: sign up and login (email and Google).
- MongoDB Atlas: all app data.

Free plan limits: SerpApi gives 250 searches a month per key. To save searches, the server keeps
each search for 6 hours and each product page for 24 hours, and a repeat uses no search.
Each AI verdict is kept for the rest of the day.


7. Tests
--------
Two kinds of tests. Neither one calls SerpApi or Gemini: the tests use saved responses from
tests/fixtures/.

Unit tests (Vitest), 106 tests in 11 files, in the __tests__ folders:
  npm run test:unit
They test the pure logic: the Deal check rules, price history, the budget planner, the AI verdict
inputs, prompt and rule fallback, the SerpApi key fallback, keys, formats and search history.

End-to-end tests (Playwright), 36 tests in 12 files, in tests/:
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
- trending.spec.js, home.spec.js: Trending lists, links to Compare, photo fallback
- compare.spec.js: the price history card, with and without history
- product.spec.js: the product page, the AI verdict, and the "See what the AI read" page
- wishlist.spec.js: save and remove, search, sort, tabs, Sleep on it, Plan a budget, Buy Together,
  the remove pop-up
- target-price-alert.spec.js: set and change a target price
- friends.spec.js: friend list search, requests between the two demo accounts, the remove pop-up
- notifications.spec.js: tabs, search, mark as read, an expired Buy Together invite
- admin.spec.js, account.spec.js: admin insights and user search, account settings
- errors.spec.js: the 404 page and the server error page

The tests are repeatable: every test that changes data puts it back, and npm run seed resets the
demo accounts. A test tagged @admin runs as demo@smu.edu.sg, a test tagged @user runs as
demo.user@smu.edu.sg, and the rest run logged out.


8. Project layout
-----------------
- server.js            Express server: every /api route, and it serves the built pages from dist/.
- models/              MongoDB models (one file per collection) and the SerpApi + Gemini search.
- services/            Server logic: product pages, Deal check, price history, AI verdict inputs,
                       email, SerpApi keys.
- src/                 Vue 3 app: views/ (pages), components/, store/ (Pinia), services/, router/.
- data/                seed.js, demo-products.json (real products team members saved) and the
                       sale calendar.
- tests/               Playwright tests and fixtures.
- docs/                ERD (also at /erd in the app) and plans.


9. Use of AI / LLM
------------------
As the brief asks, these are the parts where we relied on AI.

- The first Vue screens and the first version of this README were written with AI (Hermes).
- The MongoDB models, the connection, the seed script and the ERD page were written with AI (Claude).
- Dewa used AI (Claude) to write the Playwright and Vitest test setup and tests, the demo seed data,
  the confirm pop-up, the "How the AI decided" page, the AI verdict inputs and cache, the SerpApi
  key fallback, the wishlist live price fix, the expired invite fix, and this README.

Each member adds one line here for their own part before submission.
