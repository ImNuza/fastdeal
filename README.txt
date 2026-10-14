FastDeal (IS216 G8-3)

This site is a frontend reference. Search, compare, login, wishlist, alerts, and Sleep on it run in the browser with sample listings. SerpApi, Gemini, Firebase, and email are not wired.
The server connects to MongoDB Atlas (database fastdeal). The pages do not read from it yet.

Demo account: demo@smu.edu.sg / demo1234
A search for "fail" shows the error state.

Setup
1. Copy .env.example to .env
2. Put API keys in .env. Do not commit .env
3. npm install
4. npm run seed (adds the demo account, its demo friends and notifications, 90 days of price history and Trending searches to MongoDB. Safe to run again.)

Run locally
- npm run dev
- Or npm run build, then npm start, then open http://localhost:3000
- Health check: http://localhost:3000/health
- npm start stops if it cannot reach MongoDB. Check MONGODB_URI, and turn off any VPN.

Deploy (Render)
- One web service
- Build command: npm install && npm run build
- Start command: npm start
- Add keys as environment variables in the Render dashboard. Do not paste keys into the repo.
- A push to main is the deploy if the service is already tied to this repo.

Database (MongoDB Atlas)
- Models: models/ (one file per collection: users, wishlistItems, priceDays, sleepHolds, searchLogs, searchCache, friendships, notifications)
- productKey = product name in lowercase, trimmed, single spaces. Use toProductKey in models/product-key.js.
- pairKey = the two friends' uids sorted and joined with "|". Use toPairKey in models/pair-key.js. One friendships row per pair.
- ERD and the reason for each field: /erd in the app (https://fastdeal-iqzg.onrender.com/erd), file docs/fastdeal-erd-v3.html (v2 kept for the record)
- Seed: data/seed.js. The demo login itself is a Firebase user. Its UID goes in DEMO_FIREBASE_UID.

Test
No automated tests. Open /, /compare?q=Sony%20WH-1000XM5, /trending, /login, /wishlist, and /sleep.
On first visit, choose Log in or Continue as guest. Log in opens inside the welcome popup without changing pages. The choice is remembered in this browser.

AI / LLM
The Vue screens, mock catalog, browser session, and this README were written with AI (Hermes). This commit is a reference frontend, not live search or auth.
The MongoDB models, connection, seed script, and ERD page were written with AI (Claude).
