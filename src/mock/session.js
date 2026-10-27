import axios from 'axios'
import { watch } from 'vue'
import { toProductKey } from '../../models/product-key.js'
import { user, firebaseUser, authReady, startSignup, endSignup, applyDbUser, findSaved } from '../store/auth.js'

// Auth state and logic live in src/store/auth.js (Pinia store).
// Re-export so views that import from here still work unchanged.
export { user, authReady, firebaseUser, startSignup, endSignup, applyDbUser }

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
      void axios.get('/api/wishlist').then(function (res) {
        if (user.value) user.value.wishlist = res.data
      })
    }
  })

  // Return the original operation so callers can detect failures.
  return operation
}


function keyPath(item) {
  return '/api/wishlist/' + encodeURIComponent(toProductKey(item.name))
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
