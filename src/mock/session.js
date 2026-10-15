import { ref, computed } from 'vue'
import { watchAuthState, signOutUser } from '../services/auth.js'
import { getUser } from '../services/userApi.js'

const USERS_KEY = 'fastdeal-users'

export const user = ref(null)
export const firebaseUser = ref(null)

// Becomes true after the first onAuthStateChanged callback fires.
// Views watch this before redirecting so a refresh doesn't immediately boot the user.
export const authReady = ref(false)

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
    found = { email: fbUser.email, displayName: fbUser.displayName || '', photoURL: fbUser.photoURL || '', username: dbUser.username || '', emailOn: dbUser.emailAlertsOn, wishlist: [], sleep: [] }
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
  } finally {
    // Signal to all views that Firebase has resolved — safe to check auth state now.
    authReady.value = true
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

export function saveProduct(item) {
  if (!user.value) {
    return
  }
  const list = user.value.wishlist
  for (let i = 0; i < list.length; i++) {
    if (list[i].name === item.name) {
      return
    }
  }
  const saved = Number(item.savedPrice)
  list.push({
    name: item.name,
    savedPrice: saved,
    targetPrice: Math.round(saved * 0.9 * 100) / 100,
    savedAt: Date.now()
  })
  persist()
}

export function isSaved(name) {
  if (!user.value) {
    return false
  }
  const list = user.value.wishlist
  for (let i = 0; i < list.length; i++) {
    if (list[i].name === name) {
      return true
    }
  }
  return false
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

export function sleepOn(name) {
  if (!user.value) {
    return
  }
  const list = user.value.sleep
  for (let i = 0; i < list.length; i++) {
    if (list[i].name === name) {
      return
    }
  }
  list.push({
    name: name,
    endsAt: Date.now() + 24 * 3600000
  })
  persist()
}

export function isAsleep(name) {
  if (!user.value) {
    return false
  }
  const list = user.value.sleep
  for (let i = 0; i < list.length; i++) {
    if (list[i].name === name) {
      return true
    }
  }
  return false
}

export function removeSleep(name) {
  if (!user.value) {
    return
  }
  const next = []
  const list = user.value.sleep
  for (let i = 0; i < list.length; i++) {
    if (list[i].name !== name) {
      next.push(list[i])
    }
  }
  user.value.sleep = next
  persist()
}
