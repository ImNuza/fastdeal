// Demo data for the demo@smu.edu.sg account, price history and Trending.
// Run: npm run seed. Safe to run again: it deletes its own rows first.
// Needs MONGODB_URI and DEMO_FIREBASE_UID in .env.
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import PriceDay from '../models/price-day-model.js'
import SearchLog from '../models/search-log-model.js'
import SleepHold from '../models/sleep-hold-model.js'
import User from '../models/user-model.js'
import WishlistItem from '../models/wishlist-item-model.js'
import { toProductKey } from '../models/product-key.js'

dotenv.config()

const DEMO_EMAIL = 'demo@smu.edu.sg'
const HOUR = 3600000
const DAY = 24 * HOUR

// Lowest price for the last 14 days, oldest first. Same numbers as src/mock/catalog.js.
const products = [
  { name: 'Sony WH-1000XM5', store: 'Shopee', history: [489, 479, 469, 459, 449, 419, 449, 439, 429, 439, 449, 435, 441, 429] },
  { name: 'Apple AirPods Pro 2', store: 'Shopee', history: [289, 279, 299, 309, 319, 305, 299, 289, 295, 309, 319, 329, 315, 319] },
  { name: 'Nintendo Switch OLED', store: 'Shopee', history: [459, 449, 439, 429, 419, 410, 429, 439, 449, 435, 429, 425, 419, 419] },
  { name: 'Kindle Paperwhite', store: 'Amazon.sg', history: [219, 209, 205, 199, 195, 186, 199, 205, 199, 195, 189, 195, 199, 189] },
  { name: 'Bose QuietComfort Ultra', store: 'Courts', history: [499, 489, 479, 505, 519, 499, 489, 479, 495, 509, 519, 529, 515, 509] }
]

// Each inner list is one browser session: [what the user typed, product it matched].
const sessions = [
  [['xm5', 'Sony WH-1000XM5'], ['airpods pro', 'Apple AirPods Pro 2'], ['bose qc ultra', 'Bose QuietComfort Ultra']],
  [['sony headphones', 'Sony WH-1000XM5'], ['bose', 'Bose QuietComfort Ultra']],
  [['switch oled', 'Nintendo Switch OLED'], ['kindle', 'Kindle Paperwhite']],
  [['airpods', 'Apple AirPods Pro 2'], ['Sony WH-1000XM5', 'Sony WH-1000XM5']],
  [['kindle paperwhite', 'Kindle Paperwhite'], ['nintendo switch', 'Nintendo Switch OLED'], ['wh-1000xm5', 'Sony WH-1000XM5']],
  [['dyson hair dryer', 'Dyson Supersonic'], ['airpods pro 2', 'Apple AirPods Pro 2']],
  [['hydro flask', 'Hydro Flask 32 oz'], ['sony xm5', 'Sony WH-1000XM5']],
  [['airpods', 'Apple AirPods Pro 2'], ['switch', 'Nintendo Switch OLED']]
]

// "YYYY-MM-DD" in Singapore time (UTC+8, no daylight saving).
function sgDay(time) {
  return new Date(time + 8 * HOUR).toISOString().slice(0, 10)
}

async function seed() {
  const uid = process.env.DEMO_FIREBASE_UID
  if (!uid) {
    console.error('Add DEMO_FIREBASE_UID to .env first. It is the Firebase UID of ' + DEMO_EMAIL + '.')
    process.exit(1)
  }

  const now = Date.now()

  try {
    await mongoose.connect(process.env.MONGODB_URI)

    // Price history
    const priceDays = []
    for (const product of products) {
      for (let i = 0; i < product.history.length; i++) {
        priceDays.push({
          productKey: toProductKey(product.name),
          day: sgDay(now - (product.history.length - 1 - i) * DAY),
          price: product.history[i],
          store: product.store
        })
      }
    }
    await PriceDay.deleteMany({
      productKey: { $in: priceDays.map((row) => row.productKey) },
      day: { $in: priceDays.map((row) => row.day) }
    })
    await PriceDay.insertMany(priceDays)

    // Demo user
    await User.deleteMany({ $or: [{ firebaseUid: uid }, { email: DEMO_EMAIL }] })
    await User.create({ firebaseUid: uid, email: DEMO_EMAIL, emailAlertsOn: true })

    // Wishlist: one "Target reached", one "Dropped 10% or more"
    await WishlistItem.deleteMany({ firebaseUid: uid })
    await WishlistItem.insertMany([
      {
        firebaseUid: uid,
        productName: 'Sony WH-1000XM5',
        productKey: toProductKey('Sony WH-1000XM5'),
        savedPrice: 489,
        targetPrice: 430,
        latestPrice: 429,
        latestStore: 'Shopee',
        latestLink: 'https://shopee.sg/search?keyword=sony%20wh-1000xm5',
        flag: 'target',
        lastCheckedAt: new Date(now - 2 * HOUR),
        savedAt: new Date(now - 13 * DAY)
      },
      {
        firebaseUid: uid,
        productName: 'Kindle Paperwhite',
        productKey: toProductKey('Kindle Paperwhite'),
        savedPrice: 219,
        targetPrice: null,
        latestPrice: 189,
        latestStore: 'Amazon.sg',
        latestLink: 'https://www.amazon.sg/s?k=kindle+paperwhite',
        flag: 'drop',
        lastCheckedAt: new Date(now - 2 * HOUR),
        savedAt: new Date(now - 13 * DAY)
      }
    ])

    // Sleep holds: one still counting down, one ended and waiting for an answer
    await SleepHold.deleteMany({ firebaseUid: uid })
    await SleepHold.insertMany([
      {
        firebaseUid: uid,
        productName: 'Apple AirPods Pro 2',
        productKey: toProductKey('Apple AirPods Pro 2'),
        priceAtStart: 329,
        latestPrice: 319,
        startedAt: new Date(now - 20 * HOUR),
        endsAt: new Date(now + 4 * HOUR),
        status: 'waiting'
      },
      {
        firebaseUid: uid,
        productName: 'Nintendo Switch OLED',
        productKey: toProductKey('Nintendo Switch OLED'),
        priceAtStart: 425,
        latestPrice: 419,
        startedAt: new Date(now - 26 * HOUR),
        endsAt: new Date(now - 2 * HOUR),
        status: 'waiting'
      }
    ])

    // Anonymous search logs for Trending and "searched together"
    const logs = []
    for (let s = 0; s < sessions.length; s++) {
      for (let i = 0; i < sessions[s].length; i++) {
        const [query, productName] = sessions[s][i]
        logs.push({
          sessionId: 'seed-' + (s + 1),
          query: query,
          productName: productName,
          productKey: toProductKey(productName),
          searchedAt: new Date(now - (s + 1) * 7 * HOUR + i * 2 * 60000)
        })
      }
    }
    await SearchLog.deleteMany({ sessionId: /^seed-/ })
    await SearchLog.insertMany(logs)

    console.log('Seeded ' + priceDays.length + ' priceDays, 1 user, 2 wishlistItems, 2 sleepHolds, ' + logs.length + ' searchLogs')
  } catch (error) {
    console.error('Seed failed:', error.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

seed()
