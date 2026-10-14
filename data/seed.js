// Demo data for the demo@smu.edu.sg account, its friends, price history and Trending.
// Run: npm run seed. Safe to run again: it deletes its own rows first.
// It also deletes every friendship and notification of the demo account, so the demo starts clean.
// Needs MONGODB_URI and DEMO_FIREBASE_UID in .env.
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Friendship from '../models/friendship-model.js'
import Notification from '../models/notification-model.js'
import PriceDay from '../models/price-day-model.js'
import SearchLog from '../models/search-log-model.js'
import SleepHold from '../models/sleep-hold-model.js'
import User from '../models/user-model.js'
import WishlistItem from '../models/wishlist-item-model.js'
import { toPairKey } from '../models/pair-key.js'
import { toProductKey } from '../models/product-key.js'

dotenv.config()

const DEMO_EMAIL = 'demo@smu.edu.sg'
const HOUR = 3600000
const DAY = 24 * HOUR
const HISTORY_DAYS = 90

// history = lowest price for the last 14 days, oldest first. Same numbers as src/mock/catalog.js.
// base = the usual price before those 14 days.
// Sony shows a real "was $489" for the last 7 days: its price really was $489 before.
// Bose always shows "was $599" but never sold at $599, so the discount check calls it a gimmick.
const products = [
  { name: 'Sony WH-1000XM5', store: 'Shopee', base: 499, recentOldPrice: 489, history: [489, 479, 469, 459, 449, 419, 449, 439, 429, 439, 449, 435, 441, 429] },
  { name: 'Apple AirPods Pro 2', store: 'Shopee', base: 309, history: [289, 279, 299, 309, 319, 305, 299, 289, 295, 309, 319, 329, 315, 319] },
  { name: 'Nintendo Switch OLED', store: 'Shopee', base: 449, history: [459, 449, 439, 429, 419, 410, 429, 439, 449, 435, 429, 425, 419, 419] },
  { name: 'Kindle Paperwhite', store: 'Amazon.sg', base: 219, history: [219, 209, 205, 199, 195, 186, 199, 205, 199, 195, 189, 195, 199, 189] },
  { name: 'Bose QuietComfort Ultra', store: 'Courts', base: 519, alwaysOldPrice: 599, history: [499, 489, 479, 505, 519, 499, 489, 479, 495, 509, 519, 529, 515, 509] }
]

// Small ups and downs for the days before the 14-day history
const wiggle = [0, 10, -10, 5, 15, -5, 10]

// Friends of the demo account. Database rows only: they have no Firebase login.
const friends = [
  { firebaseUid: 'seed-friend-1', email: 'alex.tan@example.com', username: 'alex.tan' },
  { firebaseUid: 'seed-friend-2', email: 'priya.k@example.com', username: 'priya_k' },
  { firebaseUid: 'seed-friend-3', email: 'marcus.lim@example.com', username: 'marcus.lim' }
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

// Whole days from now until the next 11 Nov in Singapore.
function daysTo1111(now) {
  const today = sgDay(now)
  let year = Number(today.slice(0, 4))
  if (today > year + '-11-11') {
    year = year + 1
  }
  return Math.round((Date.parse(year + '-11-11') - Date.parse(today)) / DAY)
}

async function seed() {
  const uid = process.env.DEMO_FIREBASE_UID
  if (!uid) {
    console.error('Add DEMO_FIREBASE_UID to .env first. It is the Firebase UID of ' + DEMO_EMAIL + '.')
    process.exit(1)
  }

  const now = Date.now()
  const friendUids = friends.map((friend) => friend.firebaseUid)
  const allUids = [uid, ...friendUids]
  const sony = toProductKey('Sony WH-1000XM5')
  const kindle = toProductKey('Kindle Paperwhite')
  const switchOled = toProductKey('Nintendo Switch OLED')

  try {
    await mongoose.connect(process.env.MONGODB_URI)

    // Price history: 90 days per product, with the "was" price
    const priceDays = []
    for (const product of products) {
      const older = HISTORY_DAYS - product.history.length
      for (let i = 0; i < HISTORY_DAYS; i++) {
        const daysAgo = HISTORY_DAYS - 1 - i
        const price = i < older ? product.base + wiggle[i % wiggle.length] : product.history[i - older]
        let oldPrice = null
        if (product.alwaysOldPrice) {
          oldPrice = product.alwaysOldPrice
        } else if (product.recentOldPrice && daysAgo < 7) {
          oldPrice = product.recentOldPrice
        }
        priceDays.push({
          productKey: toProductKey(product.name),
          day: sgDay(now - daysAgo * DAY),
          price: price,
          store: product.store,
          oldPrice: oldPrice
        })
      }
    }
    await PriceDay.deleteMany({
      productKey: { $in: priceDays.map((row) => row.productKey) },
      day: { $in: priceDays.map((row) => row.day) }
    })
    await PriceDay.insertMany(priceDays)

    // Clear the demo account and its friends
    await User.deleteMany({
      $or: [{ firebaseUid: { $in: allUids } }, { email: { $in: [DEMO_EMAIL, ...friends.map((friend) => friend.email)] } }]
    })
    await WishlistItem.deleteMany({ firebaseUid: { $in: allUids } })
    await SleepHold.deleteMany({ firebaseUid: uid })
    await Friendship.deleteMany({ $or: [{ requesterUid: { $in: allUids } }, { addresseeUid: { $in: allUids } }] })
    await Notification.deleteMany({ firebaseUid: { $in: allUids } })

    // Demo user and friends
    await User.create({
      firebaseUid: uid,
      email: DEMO_EMAIL,
      username: 'demo',
      emailAlertsOn: true,
      recentSearches: [
        { query: 'xm5', productKey: sony, searchedAt: new Date(now - 1 * HOUR) },
        { query: 'switch oled', productKey: switchOled, searchedAt: new Date(now - 26 * HOUR) },
        { query: 'kindle', productKey: kindle, searchedAt: new Date(now - 3 * DAY) }
      ]
    })
    await User.insertMany(friends.map((friend) => ({ ...friend, emailAlertsOn: true })))

    // Friendships: two accepted, one request waiting for the demo user
    await Friendship.insertMany([
      {
        requesterUid: uid,
        addresseeUid: 'seed-friend-1',
        pairKey: toPairKey(uid, 'seed-friend-1'),
        status: 'accepted',
        createdAt: new Date(now - 10 * DAY),
        respondedAt: new Date(now - 9 * DAY)
      },
      {
        requesterUid: 'seed-friend-2',
        addresseeUid: uid,
        pairKey: toPairKey('seed-friend-2', uid),
        status: 'accepted',
        createdAt: new Date(now - 8 * DAY),
        respondedAt: new Date(now - 8 * DAY)
      },
      {
        requesterUid: 'seed-friend-3',
        addresseeUid: uid,
        pairKey: toPairKey('seed-friend-3', uid),
        status: 'pending',
        createdAt: new Date(now - 5 * HOUR)
      }
    ])

    // Wishlist: one "Target reached", one "Dropped 10% or more". Friends share some items.
    await WishlistItem.insertMany([
      {
        firebaseUid: uid,
        productName: 'Sony WH-1000XM5',
        productKey: sony,
        savedPrice: 489,
        targetPrice: 430,
        priority: 1,
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
        productKey: kindle,
        savedPrice: 219,
        targetPrice: null,
        priority: 2,
        latestPrice: 189,
        latestStore: 'Amazon.sg',
        latestLink: 'https://www.amazon.sg/s?k=kindle+paperwhite',
        flag: 'drop',
        lastCheckedAt: new Date(now - 2 * HOUR),
        savedAt: new Date(now - 13 * DAY)
      },
      {
        firebaseUid: 'seed-friend-1',
        productName: 'Sony WH-1000XM5',
        productKey: sony,
        savedPrice: 469,
        savedAt: new Date(now - 6 * DAY)
      },
      {
        firebaseUid: 'seed-friend-2',
        productName: 'Nintendo Switch OLED',
        productKey: switchOled,
        savedPrice: 439,
        savedAt: new Date(now - 7 * DAY)
      },
      {
        firebaseUid: 'seed-friend-2',
        productName: 'Kindle Paperwhite',
        productKey: kindle,
        savedPrice: 199,
        savedAt: new Date(now - 4 * DAY)
      }
    ])

    // Sleep holds: one still counting down, one ended and waiting for an answer
    await SleepHold.insertMany([
      {
        firebaseUid: uid,
        productName: 'Apple AirPods Pro 2',
        productKey: toProductKey('Apple AirPods Pro 2'),
        priceAtStart: 329,
        latestPrice: 319,
        startedAt: new Date(now - 20 * HOUR),
        endsAt: new Date(now + 4 * HOUR),
        reason: 'better-price',
        status: 'waiting'
      },
      {
        firebaseUid: uid,
        productName: 'Nintendo Switch OLED',
        productKey: switchOled,
        priceAtStart: 425,
        latestPrice: 419,
        startedAt: new Date(now - 3 * DAY),
        endsAt: new Date(now - 2 * HOUR),
        reason: 'wait-for-sale',
        status: 'ended'
      }
    ])

    // Notifications for the demo user, newest first on the page
    await Notification.insertMany([
      {
        firebaseUid: uid,
        type: 'target-hit',
        title: 'Target reached: Sony WH-1000XM5',
        body: 'Now $429 at Shopee. Your target was $430.',
        link: '/wishlist',
        productKey: sony,
        emailedAt: new Date(now - 2 * HOUR),
        createdAt: new Date(now - 2 * HOUR)
      },
      {
        firebaseUid: uid,
        type: 'sleep-ended',
        title: 'Sleep on it is over: Nintendo Switch OLED',
        body: 'Was $425, now $419. priya_k also has it on their wishlist.',
        link: '/sleep',
        productKey: switchOled,
        createdAt: new Date(now - 2 * HOUR)
      },
      {
        firebaseUid: uid,
        type: 'price-drop',
        title: 'Price drop: Kindle Paperwhite',
        body: 'Now $189 at Amazon.sg, down from $219.',
        link: '/wishlist',
        productKey: kindle,
        readAt: new Date(now - 1 * HOUR),
        createdAt: new Date(now - 3 * HOUR)
      },
      {
        firebaseUid: uid,
        type: 'friend-request',
        title: 'marcus.lim sent you a friend request',
        link: '/friends',
        fromUid: 'seed-friend-3',
        createdAt: new Date(now - 5 * HOUR)
      },
      {
        firebaseUid: uid,
        type: 'sale-soon',
        title: '11.11 is in ' + daysTo1111(now) + ' days',
        body: 'Sony WH-1000XM5 is on your wishlist. Big sales often start on 11 Nov.',
        link: '/wishlist',
        productKey: sony,
        readAt: new Date(now - 20 * HOUR),
        createdAt: new Date(now - 26 * HOUR)
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

    console.log(
      'Seeded ' + priceDays.length + ' priceDays, ' + (1 + friends.length) + ' users, 3 friendships, ' +
        '5 wishlistItems, 2 sleepHolds, 5 notifications, ' + logs.length + ' searchLogs'
    )
  } catch (error) {
    console.error('Seed failed:', error.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

seed()
