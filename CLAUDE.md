# FastDeal — Claude Session Notes

## What was done in this session

### Firebase Authentication wired up

Replaced the old mock `session.js` login/signup with real Firebase Auth.

**New files:**
- `src/firebase.js` — Firebase app init, reads config from `.env`
- `src/services/auth.js` — all auth functions using async/await:
  - `signInWithGoogle()` — Google popup sign-in
  - `signInWithEmail(email, password)`
  - `signUpWithEmail(email, password)`
  - `resetPassword(email)` — sends Firebase password reset email
  - `signOutUser()`
  - `watchAuthState(callback)` — listens to auth state changes

**Updated files:**
- `src/views/LoginView.vue` — Google button (primary) + email/password form + Forgot password pop-up (sends the reset email with `sendPasswordResetEmail`)
- `src/views/SignupView.vue` — Google button (primary) + email/password form
- `src/mock/session.js` — `watchAuthState` now syncs Firebase user into the existing `user` ref; Sleep on it holds now live on each wishlist item as `sleepUntil` (there is no separate sleep list or `/sleep` page)
- `src/views/AccountView.vue` — Log out button calls `signOutUser()` from Firebase (the navbar account icon links here once logged in)
- `src/main.js` — removed `initSession()` call (Firebase `onAuthStateChanged` handles session restore on reload)
- `.env` — real Firebase project keys are filled in

### Firebase project details
- Project ID: `fastdeal-e1b56`
- Auth domain: `fastdeal-e1b56.firebaseapp.com`
- Messaging sender: `221615439446`

### MongoDB user sync wired up (latest)

**New file:**
- `src/services/userApi.js` — axios wrappers: `createOrGetUser(uid, email)`, `getUser(uid)`, `updateUser(uid, patch)`

**Updated files:**
- `server.js` — added `POST /api/users` (upsert), `GET /api/users/:uid`, `PUT /api/users/:uid`; added `express.json()` middleware
- `src/mock/session.js` — `watchAuthState` now calls `createOrGetUser` on every login (safe upsert); `toggleEmail` also calls `updateUser` to persist `emailAlertsOn` to MongoDB

**How it works:**
- Sign up / Google login → Firebase auth state fires → `createOrGetUser` POST upserts the user row in MongoDB → local `user.value` is populated
- Login (returning user) → same POST (upsert finds existing, no duplicate)
- `emailAlertsOn` is read from MongoDB on every login and written back on toggle
- Wishlist / sleep still localStorage-only — migrate those next

### Things still to do
- Migrate wishlist (`wishlistItems` collection) and sleep holds (`sleepHolds` collection) from localStorage to MongoDB API calls
- Enable **Google** sign-in method in Firebase Console → Authentication → Sign-in method (required before Google popup works)
- Add `localhost` to Firebase Console → Authentication → Settings → Authorised domains

### Pattern used for auth (async/await + try/catch)
```js
async function onGoogleSignIn() {
  loading.value = true
  try {
    await signInWithGoogle()
    router.push('/')
  } catch (err) {
    errorText.value = err.message
  } finally {
    loading.value = false
  }
}
```

### How to run
```bash
npm install
npm run dev
```
