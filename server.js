import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'
import User from './models/user-model.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000
const proposalPath = path.join(__dirname, 'data', 'proposal.json')
const erdPath = path.join(__dirname, 'docs', 'fastdeal-erd-v3.html')
const erdPresentPath = path.join(__dirname, 'docs', 'fastdeal-erd-present.html')

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

// --- User routes ---

// Create or return existing user (called after Firebase signup/Google login)
app.post('/api/users', async (req, res) => {
  const { firebaseUid, email } = req.body
  if (!firebaseUid || !email) {
    return res.status(400).json({ error: 'firebaseUid and email are required' })
  }
  try {
    const user = await User.findOneAndUpdate(
      { firebaseUid },
      { $set: { email }, $setOnInsert: { emailAlertsOn: true } },
      { upsert: true, new: true }
    )
    console.log('[POST /api/users] upserted:', user.email, '| uid:', user.firebaseUid)
    res.json(user)
  } catch (err) {
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

// Update user (e.g. toggle email alerts)
app.put('/api/users/:uid', async (req, res) => {
  const allowed = ['emailAlertsOn']
  const patch = {}
  for (const key of allowed) {
    if (key in req.body) patch[key] = req.body[key]
  }
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
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/proposal', (req, res) => {
  const raw = fs.readFileSync(proposalPath, 'utf8')
  res.json(JSON.parse(raw))
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
