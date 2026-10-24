// Auth store — FastDeal uses Firebase Auth + plain Vue refs instead of Pinia.
// Firebase's onAuthStateChanged handles persistence across page refreshes,
// so no localStorage STORAGE_KEY is needed (Firebase does that automatically).
//
// Follows the week 11 store pattern:
//   user        — the logged-in user object (null when logged out)
//   authReady   — true once Firebase has resolved on first page load
//   isLoggedIn  — computed shorthand, equivalent to Pinia's isLoggedIn
//
// Route guarding: router/index.js uses meta: { requiresAuth, requiresRole }
// with a beforeEach guard that waits for authReady before checking.

import { computed } from 'vue'
import { user, authReady, firebaseUser, startSignup, endSignup, applyDbUser } from '../mock/session.js'

export { user, authReady, firebaseUser, startSignup, endSignup, applyDbUser }

// Equivalent to Pinia auth store's isLoggedIn computed.
export const isLoggedIn = computed(() => !!user.value)
