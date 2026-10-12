import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const proposalPath = path.join(__dirname, 'data', 'proposal.json')
const erdPath = path.join(__dirname, 'docs', 'fastdeal-erd-v2.html')

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

app.get('/api/proposal', (req, res) => {
  const raw = fs.readFileSync(proposalPath, 'utf8')
  res.json(JSON.parse(raw))
})

// Database ERD for the team and graders
app.get('/erd', (req, res) => {
  res.sendFile(erdPath)
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
