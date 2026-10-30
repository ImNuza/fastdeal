// import dotenv from 'dotenv'
// dotenv.config()
import 'dotenv/config'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import fs from 'fs'
import mongoose from 'mongoose'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import User from './models/user-model.js'
import Friendship from './models/friendship-model.js'
import { toPairKey } from './models/pair-key.js'
import { search,identifyImage } from './models/shoppingapimodel.js'
import SearchLog from './models/search-log-model.js'
import PriceDay from './models/price-day-model.js'
import { sgDay } from './services/priceHistory.js'
import { SALE_EVENTS, STORE_SALES } from './data/sale-calendar.js'
import { toProductKey } from './models/product-key.js'
import { error } from 'console'
import Notification from './models/notification-model.js'
import WishlistItem from './models/wishlist-item-model.js'
import { getProduct } from './services/productService.js'
import { findBuyTogetherFriends, findFriendOverlap, notifyBuyTogether } from './services/buyTogether.js'
import { checkTargetPrice } from './services/targetPriceEmail.js'




const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000
const proposalPath = path.join(__dirname, 'data', 'proposal.json')
const erdPath = path.join(__dirname, 'docs', 'fastdeal-erd-v4.html')
const erdV3Path = path.join(__dirname, 'docs', 'fastdeal-erd-v3.html')
const erdPresentPath = path.join(__dirname, 'docs', 'fastdeal-erd-present.html')
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

// Checking a login token needs only the project id, not a service account key.
initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID })

// Routes for one user's data. The client sends "Authorization: Bearer <Firebase ID token>".
// The uid comes from the checked token (req.uid), never from the URL, query or body.
async function requireUser(req, res, next) {
  const header = req.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Log in first' })
  try {
    const decoded = await getAuth().verifyIdToken(token)
    req.uid = decoded.uid
    req.email = decoded.email || null
    next()
  } catch (err) {
    res.status(401).json({ error: 'Your login has expired. Log in again.' })
  }
}

// Query and body values can arrive as objects (?q[$ne]=x). Use only plain strings.
function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

// --- User routes ---
// Literal paths (/search, /login-email, /me) only. No route takes a uid from the URL.

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/

// Search users by username (partial, case-insensitive). Returns each result
// with the friendship status between that user and me. No emails.
app.get('/api/users/search', requireUser, async (req, res) => {
  const q = text(req.query.q)
  if (!q) return res.status(400).json({ error: 'q required' })
  const myUid = req.uid
  try {
    // Escape the text so "." or ".*" matches itself, not every username.
    const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const users = await User.find({
      username: { $regex: pattern, $options: 'i' },
      firebaseUid: { $ne: myUid }
    }).select('firebaseUid username').limit(20)

    const pairKeys = users.map(u => toPairKey(myUid, u.firebaseUid))
    const friendships = await Friendship.find({ pairKey: { $in: pairKeys } })
    const fMap = {}
    for (const f of friendships) fMap[f.pairKey] = f

    const results = users.map(u => {
      const pk = toPairKey(myUid, u.firebaseUid)
      const f = fMap[pk]
      return {
        firebaseUid: u.firebaseUid,
        username: u.username,
        pairKey: pk,
        friendshipStatus: f ? f.status : null,
        iRequested: f ? f.requesterUid === myUid : null
      }
    })
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Login with a username. Firebase signs in with an email, so the server finds the email and
// returns it only when the password is right. A wrong username and a wrong password get the
// same answer, so nobody can use this route to collect emails.
app.post('/api/users/login-email', async (req, res) => {
  const username = text(req.body.username).toLowerCase()
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  if (!username || !password) return res.status(400).json({ error: 'Enter your username and password.' })
  try {
    const user = await User.findOne({ username }).select('email')
    if (!user) return res.status(401).json({ error: 'Username/email or password is wrong.' })
    const check = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + process.env.VITE_FIREBASE_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password, returnSecureToken: false })
      }
    )
    if (!check.ok) {
      const body = await check.json().catch(() => ({}))
      const reason = body.error && body.error.message ? body.error.message : ''
      if (reason.startsWith('TOO_MANY_ATTEMPTS')) {
        return res.status(429).json({ error: 'Too many tries. Wait a few minutes, then try again.' })
      }
      return res.status(401).json({ error: 'Username/email or password is wrong.' })
    }
    res.json({ email: user.email })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create or return the logged-in user's row (after Firebase signup or Google login).
// Pass username only on the first email signup. Google users set it later on /set-username.
app.post('/api/users', requireUser, async (req, res) => {
  if (!req.email) return res.status(400).json({ error: 'This account has no email.' })
  const setOnInsert = { emailAlertsOn: true }
  const username = text(req.body.username).toLowerCase()
  if (username) {
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'Username must be 3–20 chars: letters, numbers, _ or .' })
    }
    setOnInsert.username = username
  }
  try {
    const user = await User.findOneAndUpdate(
      { firebaseUid: req.uid },
      { $set: { email: req.email }, $setOnInsert: setOnInsert },
      { upsert: true, new: true }
    )
    res.json(user)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Username already taken' })
    res.status(500).json({ error: err.message })
  }
})

// My profile
app.get('/api/users/me', requireUser, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.uid })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update my profile. Allows emailAlertsOn, username and telegramUsername.
// Username must match USERNAME_RE and be unique.
app.put('/api/users/me', requireUser, async (req, res) => {
  try {
    const patch = {}
    if ('emailAlertsOn' in req.body) patch.emailAlertsOn = req.body.emailAlertsOn === true
    if ('username' in req.body) {
      const u = text(req.body.username).toLowerCase()
      if (!USERNAME_RE.test(u)) {
        return res.status(400).json({ error: 'Username must be 3–20 chars: letters, numbers, _ or .' })
      }
      patch.username = u
    }
    if ('telegramUsername' in req.body) {
      const handle = text(req.body.telegramUsername).replace(/^@/, '')
      if (handle && !/^[A-Za-z0-9_]{5,32}$/.test(handle)) {
        return res.status(400).json({ error: 'Telegram username must be 5 to 32 letters, numbers or _' })
      }
      patch.telegramUsername = handle || null
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update' })
    const user = await User.findOneAndUpdate(
      { firebaseUid: req.uid },
      { $set: patch },
      { new: true }
    )
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Username already taken' })
    res.status(500).json({ error: err.message })
  }
})

// --- Friendship routes ---
// Every route acts as the logged-in user (req.uid).

// Get accepted friends list with profile info
app.get('/api/friends', requireUser, async (req, res) => {
  const myUid = req.uid
  try {
    const rows = await Friendship.find({
      $or: [{ requesterUid: myUid }, { addresseeUid: myUid }],
      status: 'accepted'
    })
    const otherUids = rows.map(r => r.requesterUid === myUid ? r.addresseeUid : r.requesterUid)
    const users = await User.find({ firebaseUid: { $in: otherUids } }).select('firebaseUid username email')
    const uMap = {}
    for (const u of users) uMap[u.firebaseUid] = u
    const friends = rows.map(r => {
      const otherUid = r.requesterUid === myUid ? r.addresseeUid : r.requesterUid
      const u = uMap[otherUid] || {}
      return { pairKey: r.pairKey, firebaseUid: otherUid, username: u.username, email: u.email }
    })
    res.json(friends)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get pending incoming requests (others who sent to me). No emails: they are not friends yet.
app.get('/api/friends/requests', requireUser, async (req, res) => {
  const myUid = req.uid
  try {
    const rows = await Friendship.find({ addresseeUid: myUid, status: 'pending' })
    const requesterUids = rows.map(r => r.requesterUid)
    const users = await User.find({ firebaseUid: { $in: requesterUids } }).select('firebaseUid username')
    const uMap = {}
    for (const u of users) uMap[u.firebaseUid] = u
    const requests = rows.map(r => {
      const u = uMap[r.requesterUid] || {}
      return { pairKey: r.pairKey, firebaseUid: r.requesterUid, username: u.username }
    })
    res.json(requests)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Send a friend request
// Requests I sent that are still waiting for an answer, for the "Sent by you" list on Friends.
app.get('/api/friends/sent', requireUser, async (req, res) => {
  const myUid = req.uid
  try {
    const rows = await Friendship.find({ requesterUid: myUid, status: 'pending' })
    const users = await User.find({ firebaseUid: { $in: rows.map(r => r.addresseeUid) } }).select('firebaseUid username')
    const uMap = {}
    for (const u of users) uMap[u.firebaseUid] = u
    res.json(rows.map(r => {
      const u = uMap[r.addresseeUid] || {}
      return { pairKey: r.pairKey, firebaseUid: r.addresseeUid, username: u.username }
    }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/friends/request', requireUser, async (req, res) => {
  const myUid = req.uid
  const addresseeUid = text(req.body.addresseeUid)
  if (!addresseeUid) return res.status(400).json({ error: 'addresseeUid required' })
  if (addresseeUid === myUid) return res.status(400).json({ error: 'You cannot add yourself' })
  const pairKey = toPairKey(myUid, addresseeUid)
  try {
    if (!(await User.exists({ firebaseUid: addresseeUid }))) {
      return res.status(404).json({ error: 'User not found' })
    }
    const existing = await Friendship.findOne({ pairKey })
    if (existing) return res.status(409).json({ error: 'Friendship already exists', status: existing.status })
    const f = await Friendship.create({ requesterUid: myUid, addresseeUid, pairKey })

     //notification sending
    const me = await User.findOne({ firebaseUid: myUid }).select('username')
    await Notification.create({
      firebaseUid: addresseeUid,
      type: 'friend-request',
      title: 'New friend request',
      body: (me?.username || 'Someone') + ' sent you a friend request.',
      link: '/friends?tab=requests',
      fromUid: myUid
    })

    res.status(201).json(f)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Accept a pending request
app.put('/api/friends/:pairKey/accept', requireUser, async (req, res) => {
  const myUid = req.uid
  try {
    const f = await Friendship.findOneAndUpdate(
      { pairKey: req.params.pairKey, addresseeUid: myUid, status: 'pending' },
      { $set: { status: 'accepted', respondedAt: new Date() } },
      { new: true }
    )
    if (!f) return res.status(404).json({ error: 'Request not found' })
    // No notification back to the sender: only new requests notify, answers do not.
    res.json(f)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Decline or cancel/remove a friendship (delete the row)
app.delete('/api/friends/:pairKey', requireUser, async (req, res) => {
  const myUid = req.uid
  try {
    const f = await Friendship.findOneAndDelete({
      pairKey: req.params.pairKey,
      $or: [{ requesterUid: myUid }, { addresseeUid: myUid }]
    })
    if (!f) return res.status(404).json({ error: 'Friendship not found' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/proposal', (req, res) => {
  const raw = fs.readFileSync(proposalPath, 'utf8')
  res.json(JSON.parse(raw))
})

// Run a Google Shopping search (or reuse the saved one from the last 6 hours) and return it.
// sid is the browser's session id for searchLogs. Only the search page sends it.
app.get('/api/search', async (req, res) => {
  try {
    // search() also writes the searchLogs row for Trending (only when sid is sent).
    const result = await search(req.query.q, req.query.sid)
    res.json(result)
  } catch (error) {
    // The serpapi library rejects with a plain string, so error.message can be missing.
    res.status(400).json({ error: String((error && error.message) || error) })
  }
})

// Read the logged-in user's own last-10 searches (newest first).
// The user is taken from the checked token (req.uid), never from the URL.
app.get('/api/me/recent-searches', requireUser, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.uid }).select('recentSearches')
    res.json({ recentSearches: (user && user.recentSearches) || [] })
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) })
  }
})

// Record this search in the logged-in user's own last-10 list (newest first).
// The user is taken from the checked token (req.uid), never from the body.
// Dedup is by productKey: an existing entry for the same product is moved to the
// front instead of duplicated; the list is capped at 10, evicting the oldest.
app.post('/api/me/recent-searches', requireUser, async (req, res) => {
  const query = text(req.body.query)
  if (!query) return res.status(400).json({ error: 'query required' })

  // Prefer the key the client already has from /api/search; else derive it.
  const productKey = toProductKey(text(req.body.productKey) || query)
  const entry = { query, productKey, searchedAt: new Date() }

  try {
    // Step 1: drop any existing entry for this product (the "move to front" half).
    await User.updateOne(
      { firebaseUid: req.uid },
      { $pull: { recentSearches: { productKey } } }
    )

    // Step 2: prepend the new entry and keep only the newest 10.
    const updated = await User.findOneAndUpdate(
      { firebaseUid: req.uid },
      {
        $push: {
          recentSearches: {
            $each: [entry],
            $position: 0,
            $slice: 10
          }
        }
      },
      { new: true }
    ).select('recentSearches')

    if (!updated) return res.status(404).json({ error: 'User not found' })
    res.json({ recentSearches: updated.recentSearches })
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) })
  }
})

// Remove one search from the logged-in user's list: the x beside it in the search dropdown.
// Matches the query exactly as the dropdown shows it. The user is taken from the token.
app.delete('/api/me/recent-searches', requireUser, async (req, res) => {
  const query = text(req.query.query)
  if (!query) return res.status(400).json({ error: 'query required' })
  try {
    const updated = await User.findOneAndUpdate(
      { firebaseUid: req.uid },
      { $pull: { recentSearches: { query } } },
      { new: true }
    ).select('recentSearches')
    if (!updated) return res.status(404).json({ error: 'User not found' })
    res.json({ recentSearches: updated.recentSearches })
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) })
  }
})

app.post('/api/identify-image', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'photo required' })
    const name = await identifyImage(req.file.buffer.toString('base64'), req.file.mimetype)
    res.json({ name })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// One product with every store, its price history and the Deal check.
// q is the search it came from, so the page still works after a reload.
app.get('/api/product/:productId', async (req, res) => {
  try {
    const product = await getProduct(req.params.productId, req.query.q)
    res.json(product)
  } catch (error) {
    res.status(404).json({ error: String((error && error.message) || error) })
  }
})

//helper function to retrieve trending page
async function topSince(since) {
  return SearchLog.aggregate([
    { $match: { searchedAt: { $gte: since } } },
    { $sort: { searchedAt: -1 } },
    // Group by the product name the shopping API returned, not the words typed, so
    // "pooh" and "winnie the pooh" (both "Winnie the Pooh") count as one product.
    { $group: {
        _id: { $toLower: { $trim: { input: { $ifNull: ['$productName', '$productKey'] } } } },
        query: { $first: '$productName' },
        image: { $first: '$image' },
        count: { $sum: 1 }
    } },
    { $sort: { count: -1 } },
    { $limit: 13 }
  ])
}

// Home hero stats for shoppers, straight from our own data, so they are always there. Seed data
// stays in the database but is left out: seed accounts are the demo account and seed-friend-1
// to 3, and seed prices have no source.
//   drops:     the biggest real price drops on wishlists right now (latest checked price below
//              the saved price), one per product, as a percentage. Only 3% to 50%: a bigger
//              "drop" almost always means the check found a different, cheaper listing, and
//              under 3% is noise, so neither is shown to shoppers.
//   comparing: this week's biggest saving: the product and day with at least 3 real store prices
//              and the biggest cheapest-to-priciest gap, as its cheapest, median, and priciest store
//   nextSale:  the next big double-day sale from data/sale-calendar.js, and the stores that join it
//   mostSaved: the 3 products on the most real users' wishlists, shown when there are no drops
const SEED_UIDS = [process.env.DEMO_FIREBASE_UID, process.env.DEMO_USER_FIREBASE_UID,
  'seed-friend-1', 'seed-friend-2', 'seed-friend-3'].filter(Boolean)

// The next big sale on or after today (Singapore day), with whole days to go.
function nextBigSale() {
  const today = sgDay(Date.now())
  const year = Number(today.slice(0, 4))
  const upcoming = []
  for (const event of SALE_EVENTS) {
    if (!event.big) continue
    for (const y of [year, year + 1]) {
      const day = y + '-' + String(event.month).padStart(2, '0') + '-' + String(event.day).padStart(2, '0')
      if (day >= today) upcoming.push({ event: event, day: day })
    }
  }
  upcoming.sort(function (a, b) { return a.day < b.day ? -1 : 1 })
  const next = upcoming[0]
  return {
    name: next.event.name,
    id: next.event.id,
    day: next.day,
    daysAway: Math.round((Date.parse(next.day) - Date.parse(today)) / (24 * 3600000)),
    stores: STORE_SALES.filter(function (s) { return s.events.includes(next.event.id) }).map(function (s) { return s.label })
  }
}

app.get('/api/home-stats', async (req, res) => {
  try {
    // Biggest drops: one row per product (by the search it was saved from), its biggest drop.
    const cheaper = await WishlistItem.find({
      firebaseUid: { $nin: SEED_UIDS },
      latestPrice: { $gt: 0 },
      $expr: { $lt: ['$latestPrice', '$savedPrice'] }
    }).select('q productName savedPrice latestPrice latestStore').lean()
    const best = {}
    for (const item of cheaper) {
      const name = String(item.q || item.productName).replace(/"/g, '').trim()
      const key = name.toLowerCase()
      const percent = Math.round(((item.savedPrice - item.latestPrice) / item.savedPrice) * 100)
      if (percent < 3 || percent > 50) continue
      if (!best[key] || percent > best[key].percent) {
        best[key] = { name: name, percent: percent, saved: item.savedPrice, now: item.latestPrice, store: item.latestStore }
      }
    }
    const drops = Object.values(best).sort(function (a, b) { return b.percent - a.percent }).slice(0, 4)

    // Comparing pays: per product and day, cheapest vs priciest store, real prices only.
    const since = sgDay(Date.now() - 6 * 24 * 3600000)
    const spreads = await PriceDay.aggregate([
      { $match: { day: { $gte: since }, source: { $in: ['search', 'product'] } } },
      { $sort: { price: 1 } },
      { $group: {
          _id: { k: '$productKey', d: '$day' },
          low: { $first: '$price' }, lowStore: { $first: '$store' },
          high: { $last: '$price' }, highStore: { $last: '$store' },
          stores: { $sum: 1 }
      } },
      { $match: { stores: { $gte: 2 } } }
    ])
    // The example for the big card: this week's biggest saving. Of every product and day with
    // at least 3 real store prices, the one with the biggest gap between its cheapest and priciest
    // store; a bigger gap found later in the week takes its place. Shown as three of that day's
    // stores: the cheapest, the median (the one in the middle), and the priciest.
    const biggest = spreads
      .filter(function (sp) { return sp.stores >= 3 })
      .sort(function (a, b) { return (b.high - b.low) - (a.high - a.low) })[0]
    let example = null
    if (biggest) {
      const rows = await PriceDay.find({ productKey: biggest._id.k, day: biggest._id.d, source: { $in: ['search', 'product'] } })
        .sort({ price: 1 }).select('store price').lean()
      const pick = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]]
      // A search typed with quotes is saved with them; show the name without.
      example = { name: biggest._id.k.replace(/"/g, '').trim(), stores: pick.map(function (r) { return { store: r.store, price: r.price } }) }
    }

    const comparing = example ? { example: example } : null

    // The fallback for the third card when there are no believable drops: the products on the
    // most real users' wishlists, grouped by the search they were saved from.
    const mostSaved = await WishlistItem.aggregate([
      { $match: { firebaseUid: { $nin: SEED_UIDS } } },
      { $group: {
          _id: { $toLower: { $trim: { input: { $ifNull: ['$q', '$productName'] }, chars: ' "' } } },
          people: { $addToSet: '$firebaseUid' }
      } },
      { $project: { count: { $size: '$people' } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 3 }
    ])

    res.json({
      drops: drops,
      comparing: comparing,
      nextSale: nextBigSale(),
      mostSaved: mostSaved.map(function (m) { return { name: m._id, count: m.count } })
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load home stats' })
  }
})

//retrieve data for trending page
app.get('/api/trending' , async (req,res) =>{
  try {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    res.json({
      today: await topSince(startOfToday),
      week: await topSince(weekAgo)
    })
  }catch (error){
    console.log(error)
    res.status(500).json({ error: 'Failed to load trending' })
  }

})

// Lowest price on each of the last 14 days for one searched product (priceDays, written by every fresh search).
app.get('/api/price-history', async (req, res) => {
  const key = toProductKey(text(req.query.key))
  if (!key) return res.status(400).json({ error: 'key required' })
  try {
    const since = sgDay(Date.now() - 13 * 24 * 3600000)
    const days = await PriceDay.aggregate([
      // Real prices only: seeded rows have no source and are left out.
      { $match: { productKey: key, day: { $gte: since }, source: { $in: ['search', 'product'] } } },
      { $group: { _id: '$day', price: { $min: '$price' } } },
      { $sort: { _id: 1 } }
    ])
    res.json(days.map(function (d) { return { day: d._id, price: d.price } }))
  } catch (err) {
    res.status(500).json({ error: 'Failed to load price history' })
  }
})

//search with feature
app.get('/api/searched-with',async (req,res)=>{
  try{
    const sid = String(req.query.sid || '')
    const key=toProductKey(req.query.key)
    const match= await SearchLog.find({productKey: key})
    const sessionIds=[]
    for (const i of match){
      sessionIds.push(i.sessionId)
    }
    const otherSearchesRaw = await SearchLog.find({ sessionId: { $in: sessionIds , $ne: sid }, productKey: { $ne: key } })

    const otherSearches={}
    for (const i of otherSearchesRaw){
      if (Object.keys(otherSearches).includes(i.productKey)){
        otherSearches[i.productKey].count++
      }else{
        otherSearches[i.productKey]={ _id: i.productKey, query: i.query, name: i.productName, image: i.image, count: 1 }
      }
    }

    const end = Object.values(otherSearches)
    end.sort((a, b) => b.count - a.count)
    res.json(end)
  }catch(error){
    console.log(error)
    res.status(500).json({ error: 'Failed to load' })
  }
})

app.post('/api/notifications/sleep-ended', requireUser, async (req, res) => {
  const firebaseUid = req.uid
  const { productName, sleepUntil } = req.body

  const expiry = Number(sleepUntil)

  if (
    typeof firebaseUid !== 'string' ||
    !firebaseUid.trim() ||
    typeof productName !== 'string' ||
    !productName.trim() ||
    !Number.isFinite(expiry) ||
    expiry <= 0
  ) {
    return res.status(400).json({ error: 'Invalid sleep notification data' })
  }

  // Do not notify before the countdown expires.
  if (expiry > Date.now()) {
    return res.status(400).json({ error: 'Sleep timer has not expired' })
  }

  try {
    // Unique identifier for this particular countdown.
    const productKey = `${productName}:${expiry}`

    const result = await Notification.findOneAndUpdate(
      {
        firebaseUid,
        type: 'sleep-ended',
        productKey
      },
      {
        $setOnInsert: {
          title: 'Sleep On It completed!',
          body: `Your waiting period for ${productName} has ended. View your purchase verdict.`,
          link: '/wishlist?verdict=' + encodeURIComponent(productName),
          read: false
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        includeResultMetadata: true
      }
    )
    const notification = result.value

    // Only on the first expiry — check if any friends saved the same product.
    if (!result.lastErrorObject?.updatedExisting) {
      try {
        await notifyBuyTogether(firebaseUid, productName)
      } catch (btErr) {
        console.error('[Buy Together] notification failed:', btErr)
      }
    }

    res.json(result.value)
  } catch (error) {
    console.error('[Sleep On It] Notification error:', error)

    res.status(500).json({
      error: 'Could not create sleep notification'
    })
  }
})

// Add a sale-soon alert when the next big sale is this close and the user has a wishlist.
const SALE_SOON_DAYS = 14

// One alert per user per sale: productKey is "sale:<id>:<day>", for example "sale:11.11:2026-11-11".
async function addSaleSoonNotification(firebaseUid) {
  const sale = nextBigSale()
  if (sale.daysAway > SALE_SOON_DAYS) return

  const items = await WishlistItem.find({ firebaseUid }).sort({ savedAt: -1 }).select('productName').lean()
  if (!items.length) return

  const others = items.length - 1
  const saved = items[0].productName + (others ? ' and ' + others + ' more' : '')
  const when = sale.daysAway === 0 ? 'today' : sale.daysAway === 1 ? 'tomorrow' : 'in ' + sale.daysAway + ' days'
  await Notification.updateOne(
    { firebaseUid, type: 'sale-soon', productKey: 'sale:' + sale.id + ':' + sale.day },
    {
      $setOnInsert: {
        title: sale.name + ' is ' + when,
        body: saved + (others ? ' are' : ' is') + ' on your wishlist.' +
          (sale.stores.length ? ' ' + sale.stores.join(' and ') + ' usually join this sale.' : ''),
        link: '/wishlist'
      }
    },
    { upsert: true }
  )
}

//retrieve notifications
app.get('/api/notifications', requireUser, async (req, res) => {
  try {
    try {
      await addSaleSoonNotification(req.uid)
    } catch (saleErr) {
      console.error('[Sale soon] notification failed:', saleErr)
    }
    const rows = await Notification.find({ firebaseUid: req.uid }).sort({ createdAt: -1 })
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Only my own notification can be marked read.
app.put('/api/notifications/:id/read', requireUser, async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, firebaseUid: req.uid },
      { $set: { read: true, readAt: new Date() } }
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/notifications/read-all', requireUser, async (req, res) => {
  try {
    await Notification.updateMany(
      { firebaseUid: req.uid, read: false },
      { $set: { read: true, readAt: new Date() } }
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Buy Together: my friends who saved the same product, with their Telegram.
// The popup on the Notifications page calls this. Read live, never stored in a notification.
app.get('/api/buy-together', requireUser, async (req, res) => {
  const productKey = toProductKey(text(req.query.productKey))
  if (!productKey) return res.status(400).json({ error: 'productKey required' })
  try {
    res.json(await findBuyTogetherFriends(req.uid, productKey))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Send group-invite notifications to selected friends. Body: { friendUids, productKey }.
// Only accepted friends receive invites; others are silently skipped.
app.post('/api/buy-together/invite', requireUser, async (req, res) => {
  const myUid = req.uid
  const friendUids = req.body.friendUids
  const productKey = text(req.body.productKey)
  if (!Array.isArray(friendUids) || !friendUids.length || !productKey) {
    return res.status(400).json({ error: 'friendUids and productKey required' })
  }
  try {
    const me = await User.findOne({ firebaseUid: myUid }).select('username telegramUsername')
    if (!me) return res.status(404).json({ error: 'User not found' })
    if (!me.telegramUsername) {
      return res.status(400).json({ error: 'Please set your Telegram ID first before Buy Together.' })
    }
    const myItem = await WishlistItem.findOne({ firebaseUid: myUid, productKey }).select('productName')
    const productName = myItem?.productName || productKey

    const pairKeys = friendUids.map(uid => toPairKey(myUid, uid))
    const validFriendships = await Friendship.find({ pairKey: { $in: pairKeys }, status: 'accepted' })
    const validUids = new Set(validFriendships.map(f => f.requesterUid === myUid ? f.addresseeUid : f.requesterUid))

    // Skip friends I already invited for this product, so pressing twice never sends twice.
    const already = await Notification.find({ fromUid: myUid, type: 'group-invite', productKey }).select('firebaseUid')
    for (const n of already) validUids.delete(n.firebaseUid)

    const notifs = [...validUids].map(uid => ({
      firebaseUid: uid,
      type: 'group-invite',
      title: `${me.username || 'A friend'} wants to buy together!`,
      body: `${me.username || 'A friend'} saved ${productName} and wants to split the shipping.`,
      productKey,
      fromUid: myUid,
      link: '/notifications'
    }))
    if (notifs.length) await Notification.insertMany(notifs, { ordered: false })
    res.json({ sent: notifs.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Profile of a specific friend (username + telegram). Only works between accepted friends.
app.get('/api/users/profile/:firebaseUid', requireUser, async (req, res) => {
  const myUid = req.uid
  const theirUid = req.params.firebaseUid
  try {
    const ok = await Friendship.exists({ pairKey: toPairKey(myUid, theirUid), status: 'accepted' })
    if (!ok) return res.status(403).json({ error: 'Not friends' })
    const u = await User.findOne({ firebaseUid: theirUid }).select('-_id username telegramUsername')
    if (!u) return res.status(404).json({ error: 'User not found' })
    res.json({ username: u.username, telegramUsername: u.telegramUsername || null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Wishlist routes ---
// One row per saved product per user. The client keeps a copy in memory (src/mock/session.js)
// and writes every change through these routes.

// The item shape the client uses. Dates go out as milliseconds, like the old browser wishlist.
function toWishItem(row) {
  return {
    name: row.productName,
    productKey: row.productKey,
    productId: row.productId,
    q: row.q,
    image: row.image,
    savedPrice: row.savedPrice,
    savedStore: row.savedStore,
    targetPrice: row.targetPrice,
    savedAt: row.savedAt ? row.savedAt.getTime() : 0,
    sleepUntil: row.sleepUntil ? row.sleepUntil.getTime() : 0,
    sleepPriceAtStart: row.sleepPriceAtStart,
    sleepVerdictSeen: row.sleepVerdictSeen
  }
}

function priceOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

function dateOrNull(ms) {
  const n = Number(ms)
  return Number.isFinite(n) && n > 0 ? new Date(n) : null
}

app.get('/api/wishlist', requireUser, async (req, res) => {
  try {
    const rows = await WishlistItem.find({ firebaseUid: req.uid }).sort({ savedAt: 1 })
    res.json(rows.map(toWishItem))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Friends who saved the same products as me, for the friend count on each wishlist row.
app.get('/api/wishlist/friends', requireUser, async (req, res) => {
  try {
    res.json(await findFriendOverlap(req.uid))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Save a product, or switch a saved product to another store and price.
// targetPrice, savedAt and the sleep fields are used only for a new row: the one-time
// copy of an old browser wishlist sends them.
app.post('/api/wishlist', requireUser, async (req, res) => {
  const name = text(req.body.name)
  const price = priceOrNull(req.body.price)
  if (!name || !price) return res.status(400).json({ error: 'name and price required' })
  const productKey = toProductKey(name)
  const store = text(req.body.store) || null
  try {
    const existing = await WishlistItem.findOne({ firebaseUid: req.uid, productKey })
    if (existing) {
      if (store && existing.savedStore !== store) {
        existing.savedStore = store
        existing.savedPrice = price
        existing.dropNotifiedPrice = null
      }
      existing.productId = existing.productId || text(req.body.productId) || null
      existing.q = existing.q || text(req.body.q) || null
      existing.image = existing.image || text(req.body.image) || null
      await existing.save()
      return res.json(toWishItem(existing))
    }
    const row = await WishlistItem.create({
      firebaseUid: req.uid,
      productName: name,
      productKey,
      productId: text(req.body.productId) || null,
      q: text(req.body.q) || null,
      image: text(req.body.image) || null,
      savedPrice: price,
      savedStore: store,
      targetPrice: priceOrNull(req.body.targetPrice) || Math.round(price * 0.9 * 100) / 100,
      savedAt: dateOrNull(req.body.savedAt) || new Date(),
      sleepUntil: dateOrNull(req.body.sleepUntil),
      sleepPriceAtStart: priceOrNull(req.body.sleepPriceAtStart),
      sleepVerdictSeen: req.body.sleepVerdictSeen === true
    })
    res.status(201).json(toWishItem(row))
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Already saved' })
    res.status(500).json({ error: err.message })
  }
})



app.patch('/api/wishlist/:productKey', requireUser, async (req, res) => {
  try {
    const row = await WishlistItem.findOne({
      firebaseUid: req.uid,
      productKey: req.params.productKey
    })

    if (!row) {
      return res.status(404).json({ error: 'Not in your wishlist' })
    }

    const set = {}

    if ('targetPrice' in req.body) {
      const newTarget = priceOrNull(req.body.targetPrice)

      // Reset email state only if the target actually changes.
      if (row.targetPrice !== newTarget) {
        set.targetPrice = newTarget
        set.targetEmailFor = null
        set.targetNotifiedFor = null
        set.lastCheckedAt = null
      }
    }

    if ('sleepUntil' in req.body) {
      set.sleepUntil = dateOrNull(req.body.sleepUntil)
    }

    if ('sleepPriceAtStart' in req.body) {
      set.sleepPriceAtStart = priceOrNull(req.body.sleepPriceAtStart)
    }

    if ('sleepVerdictSeen' in req.body) {
      set.sleepVerdictSeen = req.body.sleepVerdictSeen === true
    }

    // An unchanged target is not an error.
    if (!Object.keys(set).length) {
      return res.json(toWishItem(row))
    }

    Object.assign(row, set)
    await row.save()

    res.json(toWishItem(row))
  } catch (error) {
    console.error('[Wishlist PATCH]', error)
    res.status(500).json({ error: 'Could not update wishlist' })
  }
})



// Check whether a saved product has reached its target price.
// Firebase authentication is verified by requireUser.
app.post(
  '/api/wishlist/:productKey/check-target',
  requireUser,
  async (req, res) => {
    try {
      const result = await checkTargetPrice(
        req.uid,
        req.params.productKey
      )

      res.json(result)
    } catch (error) {
      console.error('[Target email]', error)

      res.status(500).json({
        error: 'Could not check target price'
      })
    }
  }
)


app.delete('/api/wishlist/:productKey', requireUser, async (req, res) => {
  try {
    await WishlistItem.deleteOne({ firebaseUid: req.uid, productKey: req.params.productKey })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Admin routes ---
// requireAdmin sits after requireUser so req.uid is already set.
async function requireAdmin(req, res, next) {
  const dbUser = await User.findOne({ firebaseUid: req.uid }).select('role')
  if (!dbUser || dbUser.role !== 'admin') return res.status(403).json({ error: 'Admins only' })
  next()
}

// Admin dashboard for the last 7 or 30 days (?days=7|30), each number next to the same
// number for the period before it. Seed accounts are left out, like the Home stats.
//   kpis:     sign-ups, active shoppers (saved something), searches, items saved,
//             save rate (saves per search), price-drop alerts, target prices hit,
//             and money shoppers could save right now (wishlist items cheaper than saved)
//   daily:    searches, saves, and alerts per Singapore day, for the two charts
//   products: the 5 products saved by the most shoppers in this period, with how many set a target
//             and the best price now
app.get('/api/admin/stats', requireUser, requireAdmin, async (req, res) => {
  try {
    const days = Number(req.query.days) === 30 ? 30 : 7
    const DAY = 24 * 3600000
    const now = Date.now()
    const from = new Date(now - days * DAY)
    const prevFrom = new Date(now - 2 * days * DAY)
    const real = { firebaseUid: { $nin: SEED_UIDS } }
    const alertTypes = ['price-drop', 'target-hit']

    // One number for this period and the one before
    async function both(count) {
      const [current, previous] = await Promise.all([count(from, new Date(now)), count(prevFrom, from)])
      return { current, previous }
    }

    const [signups, active, searches, saves, drops, targets] = await Promise.all([
      both(function (a, b) { return User.countDocuments({ ...real, createdAt: { $gte: a, $lt: b } }) }),
      both(async function (a, b) {
        return (await WishlistItem.distinct('firebaseUid', { ...real, savedAt: { $gte: a, $lt: b } })).length
      }),
      both(function (a, b) { return SearchLog.countDocuments({ searchedAt: { $gte: a, $lt: b } }) }),
      both(function (a, b) { return WishlistItem.countDocuments({ ...real, savedAt: { $gte: a, $lt: b } }) }),
      both(function (a, b) { return Notification.countDocuments({ ...real, type: 'price-drop', createdAt: { $gte: a, $lt: b } }) }),
      both(function (a, b) { return Notification.countDocuments({ ...real, type: 'target-hit', createdAt: { $gte: a, $lt: b } }) })
    ])

    function rate(s, q) { return q ? Math.round((s / q) * 1000) / 10 : 0 }
    const saveRate = { current: rate(saves.current, searches.current), previous: rate(saves.previous, searches.previous) }

    // Money shoppers could save now: same 3% to 50% rule as the Home price drops
    const cheaper = await WishlistItem.find({
      ...real,
      latestPrice: { $gt: 0 },
      $expr: { $lt: ['$latestPrice', '$savedPrice'] }
    }).select('savedPrice latestPrice').lean()
    let savings = 0
    let savingsItems = 0
    for (const item of cheaper) {
      const percent = ((item.savedPrice - item.latestPrice) / item.savedPrice) * 100
      if (percent < 3 || percent > 50) continue
      savings += item.savedPrice - item.latestPrice
      savingsItems++
    }

    // Per Singapore day, oldest first, with empty days filled in
    function byDay(field) {
      return [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', timezone: '+08:00', date: field } }, n: { $sum: 1 } } }]
    }
    const [searchDays, saveDays, alertDays] = await Promise.all([
      SearchLog.aggregate([{ $match: { searchedAt: { $gte: from } } }, ...byDay('$searchedAt')]),
      WishlistItem.aggregate([{ $match: { ...real, savedAt: { $gte: from } } }, ...byDay('$savedAt')]),
      Notification.aggregate([{ $match: { ...real, type: { $in: alertTypes }, createdAt: { $gte: from } } }, ...byDay('$createdAt')])
    ])
    function toMap(rows) {
      const map = {}
      rows.forEach(function (r) { map[r._id] = r.n })
      return map
    }
    const s = toMap(searchDays)
    const v = toMap(saveDays)
    const a = toMap(alertDays)
    const daily = []
    for (let i = days - 1; i >= 0; i--) {
      const day = sgDay(now - i * DAY)
      daily.push({ day, searches: s[day] || 0, saves: v[day] || 0, alerts: a[day] || 0 })
    }

    const products = await WishlistItem.aggregate([
      { $match: { ...real, savedAt: { $gte: from } } },
      { $group: {
          _id: '$productKey',
          name: { $first: '$productName' },
          image: { $first: '$image' },
          savers: { $sum: 1 },
          targets: { $sum: { $cond: [{ $gt: ['$targetPrice', null] }, 1, 0] } },
          avgSaved: { $avg: '$savedPrice' },
          bestNow: { $min: '$latestPrice' }
      } },
      { $sort: { savers: -1 } },
      { $limit: 5 }
    ])

    res.json({
      days,
      kpis: { signups, active, searches, saves, saveRate, drops, targets },
      savings: { total: Math.round(savings * 100) / 100, items: savingsItems },
      daily,
      products: products.map(function (p) {
        return {
          key: p._id,
          name: p.name,
          image: p.image,
          savers: p.savers,
          targets: p.targets,
          avgSaved: Math.round(p.avgSaved * 100) / 100,
          bestNow: p.bestNow
        }
      })
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// All users with wishlist count each
app.get('/api/admin/users', requireUser, requireAdmin, async (req, res) => {
  try {
    const [users, wishlistCounts] = await Promise.all([
      User.find().select('firebaseUid username email role createdAt emailAlertsOn telegramUsername').lean(),
      WishlistItem.aggregate([{ $group: { _id: '$firebaseUid', count: { $sum: 1 } } }])
    ])
    const countMap = {}
    wishlistCounts.forEach(function (w) { countMap[w._id] = w.count })
    // Older accounts were made before roles existed and have no role saved; they are users.
    res.json(users.map(function (u) { return { ...u, role: u.role || 'user', wishlistCount: countMap[u.firebaseUid] || 0 } }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Promote or demote a user — cannot change your own role
app.put('/api/admin/users/:firebaseUid/role', requireUser, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' })
    if (req.params.firebaseUid === req.uid) return res.status(400).json({ error: 'Cannot change your own role' })
    const updated = await User.findOneAndUpdate(
      { firebaseUid: req.params.firebaseUid },
      { $set: { role } },
      { new: true }
    ).select('firebaseUid username role')
    if (!updated) return res.status(404).json({ error: 'User not found' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Database ERD for the team and graders
app.get('/erd', (req, res) => {
  res.sendFile(erdPath)
})

// The previous version, linked from the v4 page
app.get('/erd/v3', (req, res) => {
  res.sendFile(erdV3Path)
})

// Clean ERD for presenting in class
app.get('/erd/present', (req, res) => {
  res.sendFile(erdPresentPath)
})

app.use(express.static(path.join(__dirname, 'dist')))

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('MongoDB connected to ' + mongoose.connection.name)
  } catch (error) {
    console.error('MongoDB connection failed:', error.message)
    process.exit(1)
  }
}

await connectDB()

app.listen(PORT, () => {
  console.log('FastDeal listening on port ' + PORT)
})
