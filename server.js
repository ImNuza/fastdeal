// import dotenv from 'dotenv'
// dotenv.config()
import 'dotenv/config'
import express from 'express'
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




const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000
const proposalPath = path.join(__dirname, 'data', 'proposal.json')
const erdPath = path.join(__dirname, 'docs', 'fastdeal-erd-v3.html')
const erdPresentPath = path.join(__dirname, 'docs', 'fastdeal-erd-present.html')
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

// --- User routes ---
// IMPORTANT: literal paths (/search, /lookup) must come before parameterised (:uid)
// so Express does not swallow them as uid values.

// Search users by username (partial, case-insensitive). Returns each result
// with the friendship status between that user and myUid.
// Must be defined BEFORE /api/users/:uid so Express doesn't treat 'search' as a uid value.
app.get('/api/users/search', async (req, res) => {
  const { q, myUid } = req.query
  if (!q || !myUid) return res.status(400).json({ error: 'q and myUid required' })
  try {
    const users = await User.find({
      username: { $regex: q.trim(), $options: 'i' },
      firebaseUid: { $ne: myUid }
    }).select('firebaseUid username email').limit(20)

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
        email: u.email,
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

// Look up a user's email by username — used by the login page so people can sign in
// with username instead of email (Firebase needs the email to authenticate).
app.get('/api/users/lookup', async (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ error: 'username required' })
  try {
    const user = await User.findOne({ username: username.toLowerCase().trim() }).select('email firebaseUid username')
    if (!user) return res.status(404).json({ error: 'No user with that username' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create or return existing user (called after Firebase signup/Google login).
// Pass username only on first signup with email — Google users set it separately via /set-username.
app.post('/api/users', async (req, res) => {
  const { firebaseUid, email, username } = req.body
  if (!firebaseUid || !email) {
    return res.status(400).json({ error: 'firebaseUid and email are required' })
  }
  const setOnInsert = { emailAlertsOn: true }
  if (username) setOnInsert.username = username.toLowerCase().trim()
  try {
    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { $set: { email }, $setOnInsert: setOnInsert },
      { upsert: true, new: true }
    )
    console.log('[POST /api/users] upserted:', user.email, '| username:', user.username)
    res.json(user)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Username already taken' })
    res.status(500).json({ error: err.message })
  }
})

// Get user profile
app.get('/api/users/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.params.uid })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update user — allows emailAlertsOn and username.
// Username must match /^[a-z0-9_.]{3,20}$/ and be unique.
app.put('/api/users/:uid', async (req, res) => {
  const patch = {}
  if ('emailAlertsOn' in req.body) patch.emailAlertsOn = req.body.emailAlertsOn
  if ('username' in req.body) {
    const u = req.body.username.toLowerCase().trim()
    if (!/^[a-z0-9_.]{3,20}$/.test(u)) {
      return res.status(400).json({ error: 'Username must be 3–20 chars: letters, numbers, _ or .' })
    }
    patch.username = u
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update' })
  try {
    const user = await User.findOneAndUpdate(
      { firebaseUid: req.params.uid },
      { $set: patch },
      { new: true }
    )
    if (!user) return res.status(404).json({ error: 'User not found' })
    console.log('[PUT /api/users] updated:', user.email, '| patch:', patch)
    res.json(user)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Username already taken' })
    res.status(500).json({ error: err.message })
  }
})

// --- Friendship routes ---
// All routes take ?myUid=<firebaseUid> so the server knows who is acting.


// Get accepted friends list with profile info
app.get('/api/friends', async (req, res) => {
  const { myUid } = req.query
  if (!myUid) return res.status(400).json({ error: 'myUid required' })
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

// Get pending incoming requests (others who sent to me)
app.get('/api/friends/requests', async (req, res) => {
  const { myUid } = req.query
  if (!myUid) return res.status(400).json({ error: 'myUid required' })
  try {
    const rows = await Friendship.find({ addresseeUid: myUid, status: 'pending' })
    const requesterUids = rows.map(r => r.requesterUid)
    const users = await User.find({ firebaseUid: { $in: requesterUids } }).select('firebaseUid username email')
    const uMap = {}
    for (const u of users) uMap[u.firebaseUid] = u
    const requests = rows.map(r => {
      const u = uMap[r.requesterUid] || {}
      return { pairKey: r.pairKey, firebaseUid: r.requesterUid, username: u.username, email: u.email }
    })
    res.json(requests)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Send a friend request
app.post('/api/friends/request', async (req, res) => {
  const { myUid, addresseeUid } = req.body
  if (!myUid || !addresseeUid) return res.status(400).json({ error: 'myUid and addresseeUid required' })
  const pairKey = toPairKey(myUid, addresseeUid)
  try {
    const existing = await Friendship.findOne({ pairKey })
    if (existing) return res.status(409).json({ error: 'Friendship already exists', status: existing.status })
    const f = await Friendship.create({ requesterUid: myUid, addresseeUid, pairKey })
    console.log('[POST /api/friends/request]', myUid, '→', addresseeUid)

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
app.put('/api/friends/:pairKey/accept', async (req, res) => {
  const { myUid } = req.body
  if (!myUid) return res.status(400).json({ error: 'myUid required' })
  try {
    const f = await Friendship.findOneAndUpdate(
      { pairKey: req.params.pairKey, addresseeUid: myUid, status: 'pending' },
      { $set: { status: 'accepted', respondedAt: new Date() } },
      { new: true }
    )
    if (!f) return res.status(404).json({ error: 'Request not found' })
    console.log('[PUT /api/friends/accept]', req.params.pairKey)

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
app.delete('/api/friends/:pairKey', async (req, res) => {
  const { myUid } = req.body
  if (!myUid) return res.status(400).json({ error: 'myUid required' })
  try {
    const f = await Friendship.findOneAndDelete({
      pairKey: req.params.pairKey,
      $or: [{ requesterUid: myUid }, { addresseeUid: myUid }]
    })
    if (!f) return res.status(404).json({ error: 'Friendship not found' })
    console.log('[DELETE /api/friends]', req.params.pairKey)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/proposal', (req, res) => {
  const raw = fs.readFileSync(proposalPath, 'utf8')
  res.json(JSON.parse(raw))
})

// Run a Google Shopping search, store it to src/mock/last-search.json, return it.
app.get('/api/search', async (req, res) => {
  try {
    const result = await search(req.query.q)
    try {
      await SearchLog.create({
        sessionId:1,
        productKey: result.productKey,
        query: result.query,
        productName: result.searchTerm,
        image: result.listings[0]?.image || ''
      })
    } catch (error) {
      console.log(error)
    }
    res.json(result)
  } catch (error) {
    console.log(error)
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

// Serve the raw SerpAPI response written by the last search. CompareView fetches
// this (not /mock/tempitem.json, which the Vite dev server rewrites to index.html).
app.get('/api/tempitem', (req, res) => {
  const tempItemPath = path.join(__dirname, 'src', 'mock', 'tempitem.json')
  try {
    const raw = fs.readFileSync(tempItemPath, 'utf8')
    res.type('application/json').send(raw)
  } catch (error) {
    res.status(404).json({ error: 'No search result yet' })
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


app.post('/api/notifications/sleep-ended', async (req, res) => {
  const { firebaseUid, productName, sleepUntil } = req.body

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
app.get('/api/notifications',async(req,res)=>{
  const id=req.query.id
  try {
    const rows = await Notification.find({ firebaseUid: id }).sort({ createdAt: -1 })
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id },
      { $set: { read: true, readAt: new Date() } }
    )
    res.json({ ok: true })
  } catch (err) {
    console.log(err)
  }
})

app.put('/api/notifications/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { firebaseUid: req.query.id, read: false },
      { $set: { read: true, readAt: new Date() } }
    )
    res.json({ ok: true })
  } catch (err) {
    console.log(err)
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
