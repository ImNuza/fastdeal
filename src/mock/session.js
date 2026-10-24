import axios from 'axios'
import { ref, watch } from 'vue'
import { toProductKey } from '../../models/product-key.js'
import { watchAuthState, signOutUser } from '../services/auth.js'
import { getUser } from '../services/userApi.js'

// Wishlists used to live only in this browser, under this key. Read once to copy them to MongoDB.
const OLD_USERS_KEY = 'fastdeal-users'

export const user = ref(null)
export const firebaseUser = ref(null)

// Becomes true after the first onAuthStateChanged callback fires.
// Views watch this before redirecting so a refresh doesn't immediately boot the user.
export const authReady = ref(false)

// Set true before any signup Firebase call so watchAuthState skips the DB check.
// The signup view handles DB creation itself, then calls applyDbUser.
let _signupInProgress = false
export function startSignup() { _signupInProgress = true }
export function endSignup() { _signupInProgress = false }

// Populate user.value from a DB user object, then load the wishlist from MongoDB.
// Called on login and page reload, and by the signup views after createOrGetUser.
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

// On every Firebase auth state change (login, logout, page reload):
// - Signup flow: skip — the view handles DB creation and calls applyDbUser.
// - Login / page reload: call getUser (read-only). If 404 → not registered → sign out.

watchAuthState(async function (fbUser) {
  firebaseUser.value = fbUser

  // No Firebase session — mark auth resolved immediately so views can redirect.
  if (!fbUser) {
    user.value = null
    authReady.value = true
    return
  }

  // Signup view is handling DB creation — just signal ready and let it finish.
  if (_signupInProgress) {
    authReady.value = true
    return
  }

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
    // Signal to all views that Firebase has resolved — safe to check auth state now.
    authReady.value = true
  }
})

// --- Wishlist ---
// user.value.wishlist is the in-memory copy. Every change updates it at once, then is written
// to MongoDB through /api/wishlist. Writes run one after another, so a save always reaches the
// server before the Sleep on it change that follows it.

let writes = Promise.resolve()

function write(request) {
  // Queue the database write, allowing later writes
  // to proceed even if an earlier one failed.
  const operation = writes.then(request)

  writes = operation.catch(function (err) {
    console.error('[Wishlist] Could not save the change:', err)

    // Restore the actual server data if a write fails.
    if (user.value) {
      void loadWishlist(user.value.email)
    }
  })

  // Return the original operation so callers can detect failures.
  return operation
}


function keyPath(item) {
  return '/api/wishlist/' + encodeURIComponent(toProductKey(item.name))
}

async function loadWishlist(email) {
  try {
    const { data } = await axios.get('/api/wishlist')
    // The user logged out or switched account while this was loading.
    if (!user.value || user.value.email !== email) {
      return
    }
    user.value.wishlist = data
    await copyOldWishlist(email)
  } catch (err) {
    console.error('[Wishlist] Could not load:', err)
  }
}

// Copy this user's old browser wishlist to MongoDB once, then delete the browser copy.
// If a copy fails, the browser copy stays and the next login tries again.
async function copyOldWishlist(email) {
  let list = []
  try {
    list = JSON.parse(localStorage.getItem(OLD_USERS_KEY) || '[]')
  } catch (err) {
    list = []
  }
  const mine = list.find(function (entry) { return entry.email === email })
  if (!mine) {
    return
  }
  for (const old of mine.wishlist || []) {
    if (!old.name || !(Number(old.savedPrice) > 0) || findSaved(old.name)) {
      continue
    }
    const { data } = await axios.post('/api/wishlist', {
      name: old.name,
      store: old.savedStore,
      price: old.savedPrice,
      targetPrice: old.targetPrice,
      savedAt: old.savedAt,
      sleepUntil: old.sleepUntil,
      sleepPriceAtStart: old.sleepPriceAtStart,
      sleepVerdictSeen: old.sleepVerdictSeen
    })
    user.value.wishlist.push(data)
  }
  const rest = list.filter(function (entry) { return entry.email !== email })
  if (rest.length) {
    localStorage.setItem(OLD_USERS_KEY, JSON.stringify(rest))
  } else {
    localStorage.removeItem(OLD_USERS_KEY)
  }
}

// Find a saved product: by productId first (the product page title can differ a little
// from the search card title), then by productKey of the name.
function findSaved(name, productId) {
  if (!user.value) {
    return null
  }
  const list = user.value.wishlist
  if (productId) {
    const byId = list.find(function (item) { return item.productId === productId })
    if (byId) {
      return byId
    }
  }
  const key = toProductKey(name)
  return list.find(function (item) { return toProductKey(item.name) === key }) || null
}

export function saveProduct(name, listing, product) {
  if (!user.value || !listing || !(listing.price > 0)) {
    return
  }
  const info = product || {}
  const body = {
    name: name,
    store: listing.store,
    price: listing.price,
    productId: info.productId || null,
    q: info.q || null,
    image: info.image || null
  }
  const saved = findSaved(name, info.productId)
  if (saved) {
    if (saved.savedStore === listing.store) {
      return
    }
    saved.savedStore = listing.store
    saved.savedPrice = listing.price
    body.name = saved.name
  } else {
    user.value.wishlist.push({
      name: name,
      productKey: toProductKey(name),
      productId: body.productId,
      q: body.q,
      image: body.image,
      savedPrice: listing.price,
      savedStore: listing.store,
      targetPrice: Math.round(listing.price * 0.9 * 100) / 100,
      savedAt: Date.now(),
      sleepUntil: 0,
      sleepPriceAtStart: null,
      sleepVerdictSeen: false
    })
  }
  write(function () { return axios.post('/api/wishlist', body) })
}

// Sample wishlist for trying the page: a mix of price drops, reached targets, and items on hold.
// The prices are invented, so the button only shows in development (npm run dev).
const SAMPLE_WISHLIST = [
  { name: 'Sony WH-1000XM5', savedPrice: 499, savedStore: 'Amazon.sg', targetPrice: 430, holdHours: 0 },
  { name: 'Apple AirPods Pro 2', savedPrice: 319, savedStore: 'Shopee', targetPrice: 290, holdHours: 0 },
  { name: 'Nintendo Switch OLED', savedPrice: 439, savedStore: 'Qoo10', targetPrice: 400, holdHours: 0 },
  { name: 'Kindle Paperwhite', savedPrice: 199, savedStore: 'Shopee', targetPrice: 189, holdHours: 0 },
  { name: 'Bose QuietComfort Ultra', savedPrice: 549, savedStore: 'Courts', targetPrice: 499, holdHours: 24 },
  { name: 'Dyson V15 Detect', savedPrice: 1149, savedStore: 'Courts', targetPrice: 1050, holdHours: 0 },
  { name: 'iPad Air (M2)', savedPrice: 859, savedStore: 'Amazon.sg', targetPrice: 799, holdHours: 3 },
  { name: 'Samsung Galaxy Watch 7', savedPrice: 415, savedStore: 'Lazada', targetPrice: 399, holdHours: 0 }
]

export function missingSamples() {
  if (!import.meta.env.DEV) {
    return 0
  }
  return SAMPLE_WISHLIST.filter(function (item) {
    return !findSaved(item.name)
  }).length
}

// Adds whichever sample products are not already saved; products already saved are left alone.
export function addSampleWishlist() {
  if (!user.value) {
    return
  }
  const now = Date.now()
  SAMPLE_WISHLIST.forEach(function (sample, i) {
    if (findSaved(sample.name)) {
      return
    }
    const item = {
      name: sample.name,
      productKey: toProductKey(sample.name),
      productId: null,
      q: null,
      image: null,
      savedPrice: sample.savedPrice,
      savedStore: sample.savedStore,
      targetPrice: sample.targetPrice,
      savedAt: now - (i + 1) * 86400000,
      sleepUntil: sample.holdHours ? now + sample.holdHours * 3600000 : 0,
      sleepPriceAtStart: sample.holdHours ? sample.savedPrice : null,
      sleepVerdictSeen: false
    }
    user.value.wishlist.push(item)
    write(function () {
      return axios.post('/api/wishlist', {
        name: item.name,
        store: item.savedStore,
        price: item.savedPrice,
        targetPrice: item.targetPrice,
        savedAt: item.savedAt,
        sleepUntil: item.sleepUntil,
        sleepPriceAtStart: item.sleepPriceAtStart
      })
    })
  })
}

// The store a saved product was saved from, or '' if it is not saved or the store was not recorded.
export function savedFrom(name, productId) {
  const saved = findSaved(name, productId)
  return saved && saved.savedStore ? saved.savedStore : ''
}

export function isSaved(name, productId) {
  return Boolean(findSaved(name, productId))
}



export function setTarget(name, price) {
  const item = findSaved(name)

  if (!item) {
    return Promise.reject(new Error('Wishlist product not found'))
  }

  const newTarget = Number(price)

  if (!Number.isFinite(newTarget) || newTarget < 0) {
    return Promise.reject(new Error('Invalid target price'))
  }

  item.targetPrice = newTarget

  return write(function () {
    return axios.patch(keyPath(item), {
      targetPrice: newTarget
    })
  })
}


export function removeSaved(name, productId) {
  const item = findSaved(name, productId)
  if (!item) {
    return
  }
  user.value.wishlist = user.value.wishlist.filter(function (other) { return other !== item })
  write(function () { return axios.delete(keyPath(item)) })
}

export async function toggleEmail() {
  if (!user.value || !firebaseUser.value) {
    return
  }
  user.value.emailOn = !user.value.emailOn
  try {
    const { updateUser } = await import('../services/userApi.js')
    await updateUser({ emailAlertsOn: user.value.emailOn })
  } catch (err) {
    console.warn('[FastDeal] Could not sync emailAlertsOn to MongoDB:', err.message)
  }
}

// Sleep on it: save the starting price and expiry time. The product must be saved first:
// the caller saves it from a real store, so this never falls back to a made-up price.
export function sleepOn(name, hours, priceAtStart, productId) {
  const item = findSaved(name, productId)
  if (!item) {
    return
  }
  item.sleepUntil = Date.now() + hours * 3600000
  // The price when the user starts sleeping on it, for the verdict later
  item.sleepPriceAtStart = Number.isFinite(priceAtStart) && priceAtStart > 0 ? priceAtStart : null
  // Reset whether the user has viewed the verdict
  item.sleepVerdictSeen = false
  write(function () {
    return axios.patch(keyPath(item), {
      sleepUntil: item.sleepUntil,
      sleepPriceAtStart: item.sleepPriceAtStart,
      sleepVerdictSeen: false
    })
  })
}

// Remember when a user closes the verdict
export function markSleepVerdictSeen(name) {
  const item = findSaved(name)
  if (!item) {
    return
  }
  item.sleepVerdictSeen = true
  write(function () { return axios.patch(keyPath(item), { sleepVerdictSeen: true }) })
}

// Check whether a product is still sleeping
export function isAsleep(name, now = Date.now(), productId) {
  const item = findSaved(name, productId)
  if (!item) {
    return false
  }
  return Boolean(item.sleepUntil && item.sleepUntil > now)
}

// Stop the Sleep on it timer early. The item stays in the wishlist.
export function cancelSleep(name, productId) {
  const item = findSaved(name, productId)
  if (!item) {
    return
  }
  item.sleepUntil = 0
  item.sleepPriceAtStart = null
  write(function () { return axios.patch(keyPath(item), { sleepUntil: 0, sleepPriceAtStart: null }) })
}

// When the hold on this product ends, as a timestamp. 0 when it is not on hold.
export function sleepEndsAt(name, productId) {
  const item = findSaved(name, productId)
  return item && item.sleepUntil ? item.sleepUntil : 0
}

const pendingSleepNotifications = new Set()
const completedSleepNotifications = new Set()

async function checkExpiredSleepTimers() {
  const currentUser = user.value
  const uid = firebaseUser.value?.uid

  if (!currentUser || !uid) return

  const currentTime = Date.now()

  for (const item of currentUser.wishlist || []) {
    const expiry = Number(item.sleepUntil)
    const startingPrice = Number(item.sleepPriceAtStart)

    // Only check completed countdowns with a valid starting price.
    if (
      !Number.isFinite(expiry) ||
      expiry <= 0 ||
      expiry > currentTime ||
      !Number.isFinite(startingPrice) ||
      startingPrice <= 0
    ) {
      continue
    }

    const key = `${uid}:${item.name}:${expiry}`

    if (
      pendingSleepNotifications.has(key) ||
      completedSleepNotifications.has(key)
    ) {
      continue
    }
    pendingSleepNotifications.add(key)
    try {
      // axios sends the login token (src/services/http.js). The server takes the uid from it.
      await axios.post('/api/notifications/sleep-ended', {
        productName: item.name,
        sleepUntil: expiry
      })
      completedSleepNotifications.add(key)
    } catch (error) {
      console.error('[Sleep On It] Notification failed:', error)
    } finally {
      pendingSleepNotifications.delete(key)
    }
  }
}

// Check after login or when the wishlist changes.
watch(
  [user, firebaseUser],
  () => {
    void checkExpiredSleepTimers()
  },
  { immediate: true, deep: true }
)

// Also check while the user has FastDeal open.
if (typeof window !== 'undefined') {
  window.setInterval(() => {
    void checkExpiredSleepTimers()
  }, 30000)
}
