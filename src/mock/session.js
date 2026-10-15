import { ref, computed } from 'vue'
import { watchAuthState, signOutUser } from '../services/auth.js'
import { getUser } from '../services/userApi.js'
import { cheapestListing } from './catalog.js'

const USERS_KEY = 'fastdeal-users'

export const user = ref(null)
export const firebaseUser = ref(null)

// True when the logged-in user hasn't set a username yet.
export const needsUsername = computed(() => !!(user.value && !user.value.username))

// Set true before any signup Firebase call so watchAuthState skips the DB check.
// The signup view handles DB creation itself, then calls applyDbUser.
let _signupInProgress = false
export function startSignup() { _signupInProgress = true }
export function endSignup()   { _signupInProgress = false }

// Manually populate user.value from a DB user object (called by signup views after createOrGetUser).
export function applyDbUser(dbUser, fbUser) {
  const list = readUsers()
  let found = null
  for (let i = 0; i < list.length; i++) {
    if (list[i].email === fbUser.email) { found = list[i]; break }
  }
  if (!found) {
    found = { email: fbUser.email, displayName: fbUser.displayName || '', photoURL: fbUser.photoURL || '', username: dbUser.username || '', emailOn: dbUser.emailAlertsOn, wishlist: [] }
    list.push(found)
    writeUsers(list)
  } else {
    found.username = dbUser.username || ''
    found.emailOn = dbUser.emailAlertsOn
  }
  user.value = found
  console.log('[FastDeal] user applied from DB:', dbUser)
}

// On every Firebase auth state change (login, logout, page reload):
// - Signup flow: skip — the view handles DB creation and calls applyDbUser.
// - Login / page reload: call getUser (read-only). If 404 → not registered → sign out.

watchAuthState(async function (fbUser) {
  firebaseUser.value = fbUser
  if (!fbUser) { user.value = null; return }
  if (_signupInProgress) return // signup view is handling this

  try {
    const dbUser = await getUser(fbUser.uid)
    applyDbUser(dbUser, fbUser)
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn('[FastDeal] Firebase user not in DB — signing out')
      await signOutUser()
    } else {
      console.warn('[FastDeal] DB check failed:', err.message)
    }
    user.value = null
  }
})

function readUsers() {
  const raw = localStorage.getItem(USERS_KEY)
  if (!raw) {
    return []
  }
  return JSON.parse(raw)
}

function writeUsers(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list))
}

function persist() {
  const list = readUsers()
  const current = user.value
  if (!current) {
    return
  }
  let found = false
  for (let i = 0; i < list.length; i++) {
    if (list[i].email === current.email) {
      list[i] = JSON.parse(JSON.stringify(current))
      found = true
    }
  }
  if (!found) {
    list.push(JSON.parse(JSON.stringify(current)))
  }
  writeUsers(list)
}

function seed() {
  const now = Date.now()
  const demo = {
    email: 'demo@smu.edu.sg',
    password: 'demo1234',
    emailOn: true,
    wishlist: [
      { name: 'Sony WH-1000XM5', savedPrice: 498, targetPrice: 430, savedAt: now - 5 * 86400000 },
      { name: 'Kindle Paperwhite', savedPrice: 199, targetPrice: 170, savedAt: now - 2 * 86400000 }
    ],
    sleep: [
      { name: 'Apple AirPods Pro 2', endsAt: now + 4 * 3600000 },
      { name: 'Nintendo Switch OLED', endsAt: now - 2 * 3600000 }
    ]
  }
  writeUsers([demo])
}

export function initSession() {
  if (!localStorage.getItem(USERS_KEY)) {
    seed()
  }
  // Firebase auth state watcher (set up above) handles restoring user on reload
}

export function logout() {
  user.value = null
}

// Saves the product with the store it came from. With no listing given, that is today's cheapest store.
// Saving an already saved product from a different store switches it to that store and price.
export function saveProduct(name, listing) {
  if (!user.value) {
    return
  }
  const from = listing || cheapestListing(name)
  const saved = findSaved(name)
  if (saved) {
    if (listing && saved.savedStore !== listing.store) {
      saved.savedStore = listing.store
      saved.savedPrice = listing.price
      saved.savedAt = Date.now()
      persist()
    }
    return
  }
  user.value.wishlist.push({
    name: name,
    savedPrice: from.price,
    savedStore: from.store,
    targetPrice: Math.round(from.price * 0.9 * 100) / 100,
    savedAt: Date.now(),
    sleepUntil: 0
  })
  persist()
}

// Sample wishlist for trying the page: a mix of price drops, reached targets, and items on hold.
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
  SAMPLE_WISHLIST.forEach(function (item, i) {
    if (findSaved(item.name)) {
      return
    }
    user.value.wishlist.push({
      name: item.name,
      savedPrice: item.savedPrice,
      savedStore: item.savedStore,
      targetPrice: item.targetPrice,
      savedAt: now - (i + 1) * 86400000,
      sleepUntil: item.holdHours ? now + item.holdHours * 3600000 : 0
    })
  })
  persist()
}

// The store a saved product was saved from, or '' if it is not saved or the store was not recorded.
export function savedFrom(name) {
  const saved = findSaved(name)
  return saved && saved.savedStore ? saved.savedStore : ''
}

function findSaved(name) {
  if (!user.value) {
    return null
  }
  const list = user.value.wishlist
  for (let i = 0; i < list.length; i++) {
    if (list[i].name === name) {
      return list[i]
    }
  }
  return null
}

export function isSaved(name) {
  return Boolean(findSaved(name))
}

export function setTarget(name, price) {
  if (!user.value) {
    return
  }
  const list = user.value.wishlist
  for (let i = 0; i < list.length; i++) {
    if (list[i].name === name) {
      list[i].targetPrice = Number(price)
    }
  }
  persist()
}

export function removeSaved(name) {
  if (!user.value) {
    return
  }
  const next = []
  const list = user.value.wishlist
  for (let i = 0; i < list.length; i++) {
    if (list[i].name !== name) {
      next.push(list[i])
    }
  }
  user.value.wishlist = next
  persist()
}

export async function toggleEmail() {
  if (!user.value || !firebaseUser.value) {
    return
  }
  user.value.emailOn = !user.value.emailOn
  persist()
  try {
    const { updateUser } = await import('../services/userApi.js')
    const updated = await updateUser(firebaseUser.value.uid, { emailAlertsOn: user.value.emailOn })
    console.log('[FastDeal] emailAlertsOn updated in MongoDB:', updated)
  } catch (err) {
    console.warn('[FastDeal] Could not sync emailAlertsOn to MongoDB:', err.message)
  }
}

// Sleep on it: the wishlist item is greyed out until the hold ends. Saves it first if needed.
export function sleepOn(name, hours) {
  if (!user.value) {
    return
  }
  saveProduct(name)
  findSaved(name).sleepUntil = Date.now() + hours * 3600000
  persist()
}

export function isAsleep(name, now) {
  const item = findSaved(name)
  return Boolean(item && item.sleepUntil > (now || Date.now()))
}
