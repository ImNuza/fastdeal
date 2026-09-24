FastDeal (IS216 G8-3)

This first deploy is a placeholder. It shows a snapshot of the project proposal text. It is not the price-compare app yet. Search, SerpApi, Gemini, MongoDB, and Firebase login are not wired.

Setup
1. Copy .env.example to .env
2. Put API keys in .env. Do not commit .env
3. npm install

Run locally
- npm run build
- npm start
- Open http://localhost:3000
- Health check: http://localhost:3000/health

Deploy (Render)
- One web service
- Build command: npm install && npm run build
- Start command: npm start
- Add the same keys as environment variables in the Render dashboard. Do not paste keys into the repo.

Test
No automated tests in this placeholder. Check /health returns {"ok":true} and the home page shows the proposal sections.

AI / LLM
Vue + Express boilerplate, proposal snapshot JSON, and this README were written with AI (Hermes). No core business logic, backend search endpoints, or compare-table interactivity is in this commit.
