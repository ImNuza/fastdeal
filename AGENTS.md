# FastDeal agent rules

IS216 group project. Six people push to `ImNuza/fastdeal`. Render auto-deploys `main`.
Final zip due Fri 6 Nov 2026, 9am. Feature freeze Sun 1 Nov, 23:59: after it, bug fixes and tests only.

## Before every answer
- Run `git fetch origin`, then `git status -sb` and `git log --oneline -5 origin/main`.
- If there are new commits, say what changed. Work from the latest `origin/main`.
- Git is read-only unless the person asks. Pull or branch only on request. Never commit, merge or push. The person runs those.

## Plan before code
- Plan first. Write no code and edit no file until the person explicitly says to start.
- Read-only checks (git log, git show, reading files, `npm run build`) are fine during planning.
- In every plan, name the dependencies on other members' tasks.

## Commands
```bash
npm install
npm run dev          # Vite on 5173, proxies /api to 3000
npm run start        # Express API and the built app on 3000
npm run build
npm run seed         # resets the demo account data
npm run test:e2e     # Playwright; starts both servers itself
npm run test:report
```
Run `npm run build` and `npm run test:e2e` before a change goes to `main`.

## Layout
- `server.js`: every API route. `requireUser` checks the Firebase ID token. `requireAdmin` guards `/api/admin/*`.
- `models/`: Mongoose models and `shoppingapimodel.js` (SerpApi plus Gemini search, cached in `searchCache`).
- `src/store/`: shared state and API calls (auth, wishlist, compare, product, trending, admin). Views call the stores.
- `src/router/index.js`: `requiresAuth` and `requiresRole: 'admin'` route guards.
- `tests/`: Playwright tests. Plan and owners: `docs/test-plan.md`.
- There is no `src/mock/` folder. The team removed the sample data. Do not add it back.

## Tests
- Never call SerpApi or Gemini from a test. Return a saved response from `tests/fixtures/` with `page.route`.
- Demo logins: `demo@smu.edu.sg` (admin, has the demo data) and `demo.user@smu.edu.sg` (normal user). Same password, read from `E2E_DEMO_PASSWORD` in `.env`. A test tagged `@admin` or `@user` in its title runs as that account. An untagged test runs logged out.
- Selectors: `getByRole`, then `getByLabel`, then `data-testid="feature-element"`. Never CSS classes.
- Tests must not create users. Run `npm run seed` before a full run. The seed keeps `demo@smu.edu.sg` as admin.

## Keys
- Keys live in `.env` (not tracked). Never print, paste or log a key value.
- `SERPAPI_API_KEY`: free plan, 250 searches a month for the whole team, and graders use the app until Week 18. Every live search uses one.
- `GEMINI_API_KEY`: used by `models/shoppingapimodel.js`.
- Render has its own copy of the keys. A new key must also be added in the Render dashboard.

## Gotchas
- `models/shoppingapimodel.js` hides Gemini errors and searches with the raw query. Search can look fine while Gemini is broken. Test Gemini on its own.
- `main` has both `package-lock.json` and `pnpm-lock.yaml`. Render runs `npm install`. Add packages with npm.
- `main` has no rate limit on the paid routes (`/api/search`, `/api/product/:id`, `/api/identify-image`). Commit `ef27b8c` had one, but it was on the deleted `delete-mock` branch.
- Render is on the free plan and sleeps. Open the site two minutes before a demo.
- If Render shows `update_failed` after a good build, read the app logs. A file imported but not committed causes `ERR_MODULE_NOT_FOUND`.
- Agent rules live only in this file. `CLAUDE.md` is in `.gitignore`, because Claude Code skips `AGENTS.md` when a `CLAUDE.md` exists.
