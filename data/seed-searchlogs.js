// Seeds ~100 fake searches into searchLogs.
// Run:      node data/seed-searchlogs.js
// Preview:  node data/seed-searchlogs.js --dry   (no database, no SerpAPI)
// It first deletes older seeded rows (sessionId starts with "seed-"), so you can run it again safely.

const DRY = process.argv.includes('--dry')

// productName is the clean name; queries are different ways people might type it.
// weight = how popular it is (higher = searched more often), so the ranking looks realistic.
const PRODUCTS = [
  { name: 'Sony WH-1000XM5', weight: 10, queries: ['sony wh-1000xm5', 'sony headphones', 'wh1000xm5 black', 'sony noise cancelling headphones'] },
  { name: 'iPhone 16 Pro', weight: 9, queries: ['iphone 16 pro', 'iphone 16 pro 256gb', 'apple iphone 16 pro'] },
  { name: 'AirPods Pro 2', weight: 8, queries: ['airpods pro 2', 'airpod pro 2nd gen', 'apple airpods pro'] },
  { name: 'Galaxy S25', weight: 7, queries: ['galaxy s25', 'samsung s25', 'samsung galaxy s25 128gb'] },
  { name: 'MacBook Air M3', weight: 7, queries: ['macbook air m3', 'macbook air 13 m3', 'apple macbook air'] },
  { name: 'Nintendo Switch OLED', weight: 6, queries: ['nintendo switch oled', 'switch oled', 'switch oled white'] },
  { name: 'PS5 Slim', weight: 6, queries: ['ps5 slim', 'playstation 5 slim', 'ps5 console'] },
  { name: 'Owala FreeSip', weight: 6, queries: ['owala', 'owala bottle', 'owala freesip 24oz', 'owala water bottle'] },
  { name: 'Logitech MX Master 3S', weight: 5, queries: ['logitech mx master 3s', 'mx master 3s', 'logitech wireless mouse'] },
  { name: 'Kindle Paperwhite', weight: 5, queries: ['kindle paperwhite', 'kindle 16gb', 'amazon kindle'] },
  { name: 'Anker 737 Power Bank', weight: 4, queries: ['anker 737', 'anker 737 power bank', 'anker powerbank 24000'] },
  { name: 'Bose QuietComfort Ultra', weight: 4, queries: ['bose quietcomfort ultra', 'bose qc ultra', 'bose headphones'] },
  { name: 'Dyson Supersonic', weight: 4, queries: ['dyson supersonic', 'dyson hair dryer'] },
  { name: 'Xiaomi Robot Vacuum', weight: 4, queries: ['xiaomi robot vacuum', 'xiaomi vacuum', 'mi robot vacuum x10'] },
  { name: 'Instant Pot Duo', weight: 3, queries: ['instant pot duo', 'instant pot', 'instant pot 6qt'] },
  { name: 'GoPro Hero 13', weight: 3, queries: ['gopro hero 13', 'gopro 13 black'] },
  { name: 'Hydro Flask', weight: 3, queries: ['hydro flask', 'hydroflask bottle', 'hydro flask 32oz'] },
  { name: 'JBL Flip 6', weight: 3, queries: ['jbl flip 6', 'jbl speaker', 'jbl flip 6 blue'] },
  { name: 'Fitbit Charge 6', weight: 2, queries: ['fitbit charge 6', 'fitbit tracker'] },
  { name: 'Razer DeathAdder V3', weight: 2, queries: ['razer deathadder v3', 'razer mouse'] },
  { name: 'Casio G-Shock GA-2100', weight: 2, queries: ['casio g-shock ga-2100', 'g-shock ga2100', 'casioak'] },
  { name: 'iPad Air M2', weight: 4, queries: ['ipad air m2', 'ipad air 11 inch', 'apple ipad air'] },
  { name: 'Samsung Galaxy Watch 7', weight: 3, queries: ['galaxy watch 7', 'samsung galaxy watch 7 44mm'] },
  { name: 'Dyson V15 Detect', weight: 3, queries: ['dyson v15', 'dyson v15 detect', 'dyson cordless vacuum'] },
  { name: 'Garmin Forerunner 265', weight: 2, queries: ['garmin forerunner 265', 'garmin running watch'] },
  { name: 'Nespresso Vertuo', weight: 2, queries: ['nespresso vertuo', 'nespresso machine'] },
  { name: 'Apple Watch Series 10', weight: 4, queries: ['apple watch series 10', 'apple watch 10 46mm'] },
  { name: 'Steam Deck OLED', weight: 3, queries: ['steam deck oled', 'steam deck 512gb'] },
  { name: 'Lego Icons Orchid', weight: 1, queries: ['lego orchid', 'lego icons orchid'] },
  { name: 'Sony A7 IV', weight: 1, queries: ['sony a7 iv', 'sony a7iv camera'] }
]

// Seeded random numbers: every run generates the same rows (so results are repeatable).
let seed = 2026
function rand() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const TOTAL = 100
const SESSIONS = 30
const now = new Date()
const startOfToday = new Date(now)
startOfToday.setHours(0, 0, 0, 0)

function pick() {
  const sum = PRODUCTS.reduce((s, p) => s + p.weight, 0)
  let r = rand() * sum
  for (const p of PRODUCTS) {
    r -= p.weight
    if (r <= 0) return p
  }
  return PRODUCTS[0]
}

// ~30% today, ~45% in the previous 6 days, ~25% older (8 to 30 days ago).
function randomDate() {
  const r = rand()
  if (r < 0.3) {
    const span = Math.max(now - startOfToday, 60000)
    return new Date(startOfToday.getTime() + rand() * span)
  }
  if (r < 0.75) {
    const daysAgo = 1 + rand() * 5.9
    return new Date(Math.max(now.getTime() - daysAgo * 86400000, now.getTime() - 6.95 * 86400000))
  }
  return new Date(now.getTime() - (8 + rand() * 22) * 86400000)
}

function toProductKey(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ')
}


// Words of a title, lowercased, punctuation removed: "Sony WH-1000XM5" -> ["sony","wh","1000xm5"]
function words_(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
}
// Skip listings that are accessories or parts for the product.
const BAD = /\b(case|cover|replacement|inner pot|ear pads?|strap|band only|screen protector|charger only|cable only|skin|sticker|lite)\b/i

const rows = []
for (let i = 0; i < TOTAL; i++) {
  const p = pick()
  rows.push({
    sessionId: 'seed-' + (1 + Math.floor(rand() * SESSIONS)),
    query: p.queries[Math.floor(rand() * p.queries.length)],
    productName: p.name,
    productKey: toProductKey(p.name),
    count: 1,
    image: '',
    searchedAt: randomDate()
  })
}

if (DRY) {
  const week = new Date(now.getTime() - 7 * 86400000)
  const today = rows.filter(r => r.searchedAt >= startOfToday).length
  const wk = rows.filter(r => r.searchedAt >= week).length
  const keys = new Set(rows.map(r => r.productKey)).size
  console.log('rows:', rows.length, '| today:', today, '| last 7 days:', wk, '| older:', rows.length - wk, '| unique products:', keys)
  const top = (list) => {
    const tally = {}
    for (const r of list) tally[r.productName] = (tally[r.productName] || 0) + 1
    return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }
  console.log('TOP 5 TODAY:', top(rows.filter(r => r.searchedAt >= startOfToday)))
  console.log('TOP 5 LAST 7 DAYS:', top(rows.filter(r => r.searchedAt >= week)))
  process.exit(0)
}

const { default: dotenv } = await import('dotenv')
dotenv.config()
const { default: mongoose } = await import('mongoose')
const { getJson } = await import('serpapi')
const { default: SearchLog } = await import('../models/search-log-model.js')

await mongoose.connect(process.env.MONGODB_URI)

// Images already saved on the seeded rows, so a re-run costs 0 SerpAPI credits.
// This is read before the old seeded rows are deleted below.
const saved = await SearchLog.find({ sessionId: /^seed-/, image: { $nin: ['', null] } }).select('productKey image')
const images = {}
for (const s of saved) images[s.productKey] = s.image

// Only products that appear in the rows need an image. Call SerpAPI only for those with none saved.
let serpCalls = 0
const needed = new Set(rows.map(r => r.productKey))
for (const p of PRODUCTS) {
  const key = toProductKey(p.name)
  if (!needed.has(key) || images[key]) continue
  serpCalls++
  try {
    const json = await getJson({
      engine: 'google_shopping',
      q: p.name,
      hl: 'en',
      gl: 'sg',
      api_key: process.env.SERPAPI_API_KEY
    })
    const results = (json.shopping_results || []).filter(r => r.thumbnail)
    const words = words_(p.name)
    // Prefer a result whose title has every word of the product name and no accessory words.
    const match = results.find(r => {
      const title = words_(r.title)
      return words.every(w => title.includes(w)) && !BAD.test(r.title || '')
    })
    images[key] = (match || results[0])?.thumbnail || ''
    console.log(match ? 'image ok:' : 'image (first result, no exact match):', p.name)
  } catch (e) {
    images[key] = ''
    console.log('image failed:', p.name, e.message)
  }
}
console.log('SerpApi calls:', serpCalls)
for (const r of rows) r.image = images[r.productKey] || ''

const removed = await SearchLog.deleteMany({ sessionId: /^seed-/ })
console.log('removed old seeded rows:', removed.deletedCount)
await SearchLog.insertMany(rows)
console.log('inserted', rows.length, 'rows')

await mongoose.disconnect()
