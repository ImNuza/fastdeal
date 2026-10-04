import { ref } from 'vue'

const USERS_KEY = 'fastdeal-users'
const SESSION_KEY = 'fastdeal-session'

export const user = ref(null)

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
  const email = localStorage.getItem(SESSION_KEY)
  if (!email) {
    user.value = null
    return
  }
  const list = readUsers()
  for (let i = 0; i < list.length; i++) {
    if (list[i].email === email) {
      user.value = list[i]
      return
    }
  }
  user.value = null
  localStorage.removeItem(SESSION_KEY)
}

export function signup(email, password) {
  const clean = String(email || '').trim().toLowerCase()
  if (!clean || !password) {
    return 'Enter an email and a password.'
  }
  if (String(password).length < 6) {
    return 'Use at least 6 characters.'
  }
  const list = readUsers()
  for (let i = 0; i < list.length; i++) {
    if (list[i].email === clean) {
      return 'That email already has an account.'
    }
  }
  const next = {
    email: clean,
    password: password,
    emailOn: true,
    wishlist: [],
    sleep: []
  }
  list.push(next)
  writeUsers(list)
  user.value = next
  localStorage.setItem(SESSION_KEY, clean)
  return ''
}

export function login(email, password) {
  const clean = String(email || '').trim().toLowerCase()
  const list = readUsers()
  for (let i = 0; i < list.length; i++) {
    if (list[i].email === clean && list[i].password === password) {
      user.value = list[i]
      localStorage.setItem(SESSION_KEY, clean)
      return ''
    }
  }
  return 'Email or password is wrong.'
}

export function logout() {
  user.value = null
  localStorage.removeItem(SESSION_KEY)
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

export function toggleEmail() {
  if (!user.value) {
    return
  }
  user.value.emailOn = !user.value.emailOn
  persist()
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
