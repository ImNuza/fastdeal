FastDeal (IS216 G8-3)

This site is a frontend reference. Search, compare, login, wishlist, alerts, and Sleep on it run in the browser with sample listings. SerpApi, Gemini, Firebase, MongoDB, and email are not wired.

Demo account: demo@smu.edu.sg / demo1234
A search for "fail" shows the error state.

Setup
1. Copy .env.example to .env
2. Put API keys in .env. Do not commit .env
3. npm install

Run locally
- npm run dev
- Or npm run build, then npm start, then open http://localhost:3000
- Health check: http://localhost:3000/health

Deploy (Render)
- One web service
- Build command: npm install && npm run build
- Start command: npm start
- Add keys as environment variables in the Render dashboard. Do not paste keys into the repo.
- A push to main is the deploy if the service is already tied to this repo.

Test
No automated tests. Open /, /compare?q=Sony%20WH-1000XM5, /trending, /login, /wishlist, and /sleep.
On first visit, choose Log in or Continue as guest. That choice is remembered in this browser.

AI / LLM
The Vue screens, mock catalog, browser session, and this README were written with AI (Hermes). This commit is a reference frontend, not live search or auth.
