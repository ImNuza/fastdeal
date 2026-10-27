import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { toProductKey } from '../../models/product-key.js'
import { watchAuthState, signOutUser } from '../services/auth.js'
import { getUser, updateUser } from '../services/userApi.js'

const OLD_USERS_KEY = 'fastdeal-users'

// Export the raw refs so mock/session.js (wishlist code) can import them directly.
// Both paths share the same ref objects — one source of truth.
export const user = ref(null)
export const firebaseUser = ref(null)
export const authReady = ref(false)

let _signupInProgress = false
export function startSignup() { _signupInProgress = true }
export function endSignup()   { _signupInProgress = false }

export function applyDbUser(dbUser, fbUser) {
  user.value = {
    email: fbUser.email,
    displayName: fbUser.displayName || '',
    photoURL: fbUser.photoURL || '',
    username: dbUser.username || '',
    emailOn: dbUser.emailAlertsOn,
    telegramUsername: dbUser.telegramUsername || '',
    role: dbUser.role || 'user',
    wishlist: []
  }
  void loadWishlist(fbUser.email)
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
    await copyOldWishlist(email)
  } catch (err) {
    console.error('[Wishlist] Could not load:', err)
  }
}

async function copyOldWishlist(email) {
  let list = []
  try { list = JSON.parse(localStorage.getItem(OLD_USERS_KEY) || '[]') } catch { list = [] }
  const mine = list.find(function (entry) { return entry.email === email })
  if (!mine) return
  for (const old of mine.wishlist || []) {
    if (!old.name || !(Number(old.savedPrice) > 0) || findSaved(old.name)) continue
    const { data } = await axios.post('/api/wishlist', {
      name: old.name, store: old.savedStore, price: old.savedPrice,
      targetPrice: old.targetPrice, savedAt: old.savedAt,
      sleepUntil: old.sleepUntil, sleepPriceAtStart: old.sleepPriceAtStart,
      sleepVerdictSeen: old.sleepVerdictSeen
    })
    user.value.wishlist.push(data)
  }
  const rest = list.filter(function (entry) { return entry.email !== email })
  if (rest.length) { localStorage.setItem(OLD_USERS_KEY, JSON.stringify(rest)) }
  else { localStorage.removeItem(OLD_USERS_KEY) }
}

export async function toggleEmail() {
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

watchAuthState(async function (fbUser) {
  firebaseUser.value = fbUser
  if (!fbUser) { user.value = null; authReady.value = true; return }
  if (_signupInProgress) { authReady.value = true; return }
  try {
    const dbUser = await getUser()
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

// Pinia store — wraps the refs above and adds isLoggedIn / isAdmin computed.
// Usage: const auth = useAuthStore()
//        auth.user / auth.isAdmin / auth.authReady / auth.startSignup() …
export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  return { user, authReady, firebaseUser, isLoggedIn, isAdmin, startSignup, endSignup, applyDbUser, toggleEmail }
})
