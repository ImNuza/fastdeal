import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { toProductKey } from '../../models/product-key.js'
import { watchAuthState, signOutUser } from '../services/auth.js'
import { getUser, updateUser } from '../services/userApi.js'

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------
// A refresh while the server is restarting must not look like a logout: only a 404 means the
// user is really not registered. Any other failure (server down, MongoDB not ready) is retried
// for about 10 seconds. The router guard waits for this, so the page is not sent to /login.
const PROFILE_TRIES = 5
const PROFILE_RETRY_MS = 2000

// ---------------------------------------------------------------
// State shared with the wishlist store, which imports user, firebaseUser and findSaved
// ---------------------------------------------------------------
export const user = ref(null)
export const firebaseUser = ref(null)
const authReady = ref(false)

let _signupInProgress = false

// ---------------------------------------------------------------
// Helpers (only the store below and the Firebase listener use these)
// ---------------------------------------------------------------
function startSignup() { _signupInProgress = true }
function endSignup() { _signupInProgress = false }

function applyDbUser(dbUser, fbUser) {
  user.value = {
    email: fbUser.email,
    displayName: fbUser.displayName || '',
    photoURL: fbUser.photoURL || '',
    username: dbUser.username || '',
    emailOn: dbUser.emailAlertsOn,
    telegramUsername: dbUser.telegramUsername || '',
    role: dbUser.role || 'user',
    createdAt: dbUser.createdAt || null,
    budgetDrafts: dbUser.budgetDrafts || [],
    wishlist: []
  }
  // Not awaited: the user is logged in at once and the wishlist fills in when it arrives.
  loadWishlist(fbUser.email)
}

export function findSaved(name, productId) {
  if (!user.value) return null
  const list = user.value.wishlist
  if (productId) {
    const byId = list.find(function (item) { return item.productId === productId })
    if (byId) return byId
  }
  const key = toProductKey(name)
  return list.find(function (item) { return toProductKey(item.name) === key }) || null
}

async function loadWishlist(email) {
  try {
    const { data } = await axios.get('/api/wishlist')
    if (!user.value || user.value.email !== email) return
    user.value.wishlist = data
  } catch (err) {
    console.error('[Wishlist] Could not load:', err)
  }
}

async function toggleEmail() {
  if (!user.value || !firebaseUser.value) {
    return
  }
  user.value.emailOn = !user.value.emailOn
  try {
    await updateUser({ emailAlertsOn: user.value.emailOn })
  } catch (err) {
    console.warn('[FastDeal] Could not sync emailAlertsOn to MongoDB:', err.message)
  }
}

async function loadDbUser() {
  for (let attempt = 1; ; attempt++) {
    try {
      return await getUser()
    } catch (err) {
      if (err.response?.status === 404 || attempt >= PROFILE_TRIES) throw err
      await new Promise(function (resolve) { setTimeout(resolve, PROFILE_RETRY_MS) })
    }
  }
}

watchAuthState(async function (fbUser) {
  firebaseUser.value = fbUser
  if (!fbUser) { user.value = null; authReady.value = true; return }
  if (_signupInProgress) { authReady.value = true; return }
  try {
    const dbUser = await loadDbUser()
    applyDbUser(dbUser, fbUser)
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn('[FastDeal] Firebase user not in DB — signing out')
      await signOutUser()
    } else {
      console.warn('[FastDeal] DB check failed:', err.message)
    }
    user.value = null
  } finally {
    authReady.value = true
  }
})

// ---------------------------------------------------------------
// Auth store
// Usage: const auth = useAuthStore()
//        auth.user / auth.isAdmin / auth.authReady / auth.startSignup() …
// ---------------------------------------------------------------
export const useAuthStore = defineStore('auth', () => {
  // ---------- Getters ----------
  const isAdmin = computed(() => user.value?.role === 'admin')

  return { user, authReady, firebaseUser, isAdmin, startSignup, endSignup, applyDbUser, toggleEmail }
})
