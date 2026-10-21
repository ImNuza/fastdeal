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
import { toProductKey } from './models/product-key.js'
import { error } from 'console'
import Notification from './models/notification-model.js'
import WishlistItem from './models/wishlist-item-model.js'
import { getProduct } from './services/productService.js'




const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000
const proposalPath = path.join(__dirname, 'data', 'proposal.json')
const erdPath = path.join(__dirname, 'docs', 'fastdeal-erd-v3.html')
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

// Update my profile. Allows emailAlertsOn and username.
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
      link: '/friends',
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

    //notification sending
    const me = await User.findOne({ firebaseUid: myUid }).select('username')
    await Notification.create({
      firebaseUid: f.requesterUid,
      type: 'friend-accepted',
      title: 'Friend request accepted',
      body: (me?.username || 'Someone') + ' accepted your friend request.',
      link: '/friends',
      fromUid: myUid
    })

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
    { $group: {
        _id: '$productKey',
        query: { $first: '$productName' },
        image: { $first: '$image' },
        count: { $sum: 1 }
    } },
    { $sort: { count: -1 } },
    { $limit: 13 }
  ])
}

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

    const notification = await Notification.findOneAndUpdate(
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
        setDefaultsOnInsert: true
      }
    )

    res.json(notification)
  } catch (error) {
    console.error('[Sleep On It] Notification error:', error)

    res.status(500).json({
      error: 'Could not create sleep notification'
    })
  }
})


//retrieve notifications
app.get('/api/notifications', requireUser, async (req, res) => {
  try {
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

// Database ERD for the team and graders
app.get('/erd', (req, res) => {
  res.sendFile(erdPath)
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
