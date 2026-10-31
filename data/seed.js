// Demo data for the demo@smu.edu.sg account. Run: npm run seed. Safe to run again: it deletes its own rows first.
// Real data only: no made-up people, prices or searches.
//   - Products: data/demo-products.json, five products team members really saved, with the real store,
//     price, image and Google Shopping product id.
//   - Friends: the team's own accounts. They saved the same products, so Buy Together shows.
//     One more team account (REQUEST_FROM) has a friend request waiting.
// demo@smu.edu.sg is an admin. demo.user@smu.edu.sg is a normal user with nothing saved and no friends,
// so the E2E tests can save, remove and send friend requests from a clean start.
// Needs MONGODB_URI and DEMO_FIREBASE_UID in .env. Optional: DEMO_USER_FIREBASE_UID.
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import mongoose from 'mongoose'
import Friendship from '../models/friendship-model.js'
import Notification from '../models/notification-model.js'
import SleepHold from '../models/sleep-hold-model.js'
import User from '../models/user-model.js'
import WishlistItem from '../models/wishlist-item-model.js'
import { toPairKey } from '../models/pair-key.js'
import { toProductKey } from '../models/product-key.js'

dotenv.config()

const DEMO_EMAIL = 'demo@smu.edu.sg'
const DEMO_USER_EMAIL = 'demo.user@smu.edu.sg'
const HOUR = 3600000
const DAY = 24 * HOUR

const products = JSON.parse(readFileSync(new URL('./demo-products.json', import.meta.url), 'utf8'))

// Team accounts that are friends with demo. Each saved at least one of the demo products.
const TEAM_FRIENDS = [
  'zoedharmadi.2024@smu.edu.sg',
  'jaydenchua01@gmail.com',
  'sr.susanto.2025@smu.edu.sg',
  'm.tedjakus@gmail.com',
  'lobernard07@gmail.com'
]
// Team account whose friend request waits under Requests
const REQUEST_FROM = 'dewa@nuza.dev'

// What demo does with each product, by its place in demo-products.json:
// 2 Sleep on it still counting down, 3 Sleep on it ended (purchase verdict waiting), 4 a target price.
// The target is on the newest product: it is the first row on the wishlist, and the target price
// tests change that row's target and then put the old value back.
const SLEEPING_INDEX = 2
const SLEEP_ENDED_INDEX = 3
const TARGET_INDEX = 4

async function seed() {
  const uid = process.env.DEMO_FIREBASE_UID
  if (!uid) {
    console.error('Add DEMO_FIREBASE_UID to .env first. It is the Firebase UID of ' + DEMO_EMAIL + '.')
    process.exit(1)
  }

  const now = Date.now()
  const demoUserUid = process.env.DEMO_USER_FIREBASE_UID
  const demoUids = demoUserUid ? [uid, demoUserUid] : [uid]

  try {
    await mongoose.connect(process.env.MONGODB_URI)

    // Clear the two demo accounts: their rows, friendships and notifications
    await User.deleteMany({ $or: [{ firebaseUid: { $in: demoUids } }, { email: { $in: [DEMO_EMAIL, DEMO_USER_EMAIL] } }] })
    await WishlistItem.deleteMany({ firebaseUid: { $in: demoUids } })
    await SleepHold.deleteMany({ firebaseUid: { $in: demoUids } })
    await Friendship.deleteMany({ $or: [{ requesterUid: { $in: demoUids } }, { addresseeUid: { $in: demoUids } }] })
    await Notification.deleteMany({ $or: [{ firebaseUid: { $in: demoUids } }, { fromUid: { $in: demoUids } }] })

    await User.create({
      firebaseUid: uid,
      email: DEMO_EMAIL,
      username: 'demo',
      role: 'admin',
      emailAlertsOn: true,
      recentSearches: products.slice(0, 3).map(function (product, i) {
        return { query: product.q, productKey: toProductKey(product.q), searchedAt: new Date(now - (i + 1) * 5 * HOUR) }
      })
    })
    if (demoUserUid) {
      await User.create({ firebaseUid: demoUserUid, email: DEMO_USER_EMAIL, username: 'demouser', role: 'user' })
    }

    // Wishlist: each product from the store and price a team member really saved it at
    await WishlistItem.insertMany(products.map(function (product, i) {
      const row = {
        firebaseUid: uid,
        productName: product.name,
        productKey: toProductKey(product.name),
        productId: product.productId,
        q: product.q,
        image: product.image,
        savedPrice: product.price,
        savedStore: product.store,
        priority: i + 1,
        savedAt: new Date(product.savedOn + 'T12:00:00+08:00')
      }
      if (i === TARGET_INDEX) {
        row.targetPrice = Math.floor(product.price * 0.95)
      }
      if (i === SLEEPING_INDEX) {
        row.sleepUntil = new Date(now + 20 * HOUR)
        row.sleepPriceAtStart = product.price
      }
      if (i === SLEEP_ENDED_INDEX) {
        row.sleepUntil = new Date(now - 2 * HOUR)
        row.sleepPriceAtStart = product.price
        row.sleepVerdictSeen = false
      }
      return row
    }))

    // Friends: team accounts that exist in the database. A missing account is skipped.
    const team = await User.find({ email: { $in: [...TEAM_FRIENDS, REQUEST_FROM] } }).select('firebaseUid email username').lean()
    const byEmail = {}
    for (const user of team) byEmail[user.email] = user
    const friends = TEAM_FRIENDS.map(function (email) { return byEmail[email] }).filter(Boolean)
    const requester = byEmail[REQUEST_FROM]

    const friendships = friends.map(function (friend, i) {
      return {
        requesterUid: uid,
        addresseeUid: friend.firebaseUid,
        pairKey: toPairKey(uid, friend.firebaseUid),
        status: 'accepted',
        createdAt: new Date(now - (6 - i) * DAY),
        respondedAt: new Date(now - (6 - i) * DAY + 2 * HOUR)
      }
    })
    if (requester) {
      friendships.push({
        requesterUid: requester.firebaseUid,
        addresseeUid: uid,
        pairKey: toPairKey(requester.firebaseUid, uid),
        status: 'pending',
        createdAt: new Date(now - 5 * HOUR)
      })
    }
    await Friendship.insertMany(friendships)

    // Notifications for those friendships, worded like the server's own
    const notifications = friends.slice(0, 2).map(function (friend, i) {
      return {
        firebaseUid: uid,
        type: 'friend-accepted',
        title: 'Friend request accepted',
        body: friend.username + ' accepted your friend request.',
        link: '/friends',
        fromUid: friend.firebaseUid,
        createdAt: new Date(now - (6 - i) * DAY + 2 * HOUR)
      }
    })
    if (requester) {
      notifications.push({
        firebaseUid: uid,
        type: 'friend-request',
        title: 'New friend request',
        body: requester.username + ' sent you a friend request.',
        link: '/friends?tab=requests',
        fromUid: requester.firebaseUid,
        createdAt: new Date(now - 5 * HOUR)
      })
    }
    await Notification.insertMany(notifications)

    console.log(
      'Seeded demo with ' + products.length + ' wishlist items, ' + friends.length + ' friends, ' +
        (requester ? 1 : 0) + ' friend request and ' + notifications.length + ' notifications' +
        (demoUserUid ? '. demo.user is clean.' : '. DEMO_USER_FIREBASE_UID is not set, so demo.user was skipped.')
    )
  } catch (error) {
    console.error('Seed failed:', error.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

seed()
