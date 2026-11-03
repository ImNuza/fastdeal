// Demo data for the demo@smu.edu.sg account. Run: npm run seed. Safe to run again: it deletes its own rows first.
// Real data, except one thing: the 30-day price history of the demo products.
//   - Products: data/demo-products.json, five products team members really saved, with the real store,
//     price, image and Google Shopping product id.
//   - Demo searches: data/demo-searches.json, 7 real searches and their product pages, saved once by
//     data/capture-demo.js. They go into searchCache and productCache with demo: true, so these searches
//     and their product pages never call SerpApi again and stay until DEMO_UNTIL.
//   - Price history: SerpApi gives none, so the seed writes 30 made-up days for each listing in the demo
//     searches and each wishlist product (services/priceHistory.js seededPrices), ending on the capture
//     day at the real captured price. The rows have source 'seed', so the app labels them as demo data
//     and the Home card never shows them.
//   - Friends: the team's own accounts. They saved the same products, so Buy Together shows.
//     One more team account (REQUEST_FROM) has a friend request waiting.
//     Friends who saved a demo product also send a Buy Together invite or alert to demo.
// demo@smu.edu.sg is an admin. demo.user@smu.edu.sg is a normal user with nothing saved and no friends,
// so the E2E tests can save, remove and send friend requests from a clean start.
// fastdealdemo1@gmail.com (username fastdealdemo) is the presentation account, set up for the video
// scenario: see seedPresenter below.
// Needs MONGODB_URI and DEMO_FIREBASE_UID in .env. Optional: DEMO_USER_FIREBASE_UID.
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import mongoose from 'mongoose'
import Friendship from '../models/friendship-model.js'
import Notification from '../models/notification-model.js'
import SleepHold from '../models/sleep-hold-model.js'
import User from '../models/user-model.js'
import WishlistItem from '../models/wishlist-item-model.js'
import PriceDay from '../models/price-day-model.js'
import ProductCache from '../models/product-cache-model.js'
import SearchCache from '../models/search-cache-model.js'
import { toPairKey } from '../models/pair-key.js'
import { toProductKey } from '../models/product-key.js'
import { seededPrices, sgDay } from '../services/priceHistory.js'

dotenv.config()

const DEMO_EMAIL = 'demo@smu.edu.sg'
const DEMO_USER_EMAIL = 'demo.user@smu.edu.sg'
const HOUR = 3600000
const DAY = 24 * HOUR

const products = JSON.parse(readFileSync(new URL('./demo-products.json', import.meta.url), 'utf8'))
const demo = JSON.parse(readFileSync(new URL('./demo-searches.json', import.meta.url), 'utf8'))

// The demo searches and product pages stay in the cache until after Week 18, when grading ends
const DEMO_UNTIL = new Date('2027-01-31T00:00:00+08:00')
// Noon on the capture day: the last day of every seeded history
const CAPTURED = Date.parse(demo.capturedOn + 'T12:00:00+08:00')

// 30 days of made-up prices for one listing, ending at its real price on the capture day.
// The productKey is "seed:" + the product id, so these rows never meet a live row.
// shift gives each product its own line.
function historyRows(productId, store, price, shift) {
  return seededPrices(price, shift).map(function (point) {
    return {
      updateOne: {
        filter: { productKey: 'seed:' + productId, store: store, day: sgDay(CAPTURED - point.daysAgo * DAY) },
        update: { $set: { price: point.price, source: 'seed', productId: productId } },
        upsert: true
      }
    }
  })
}

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

// The presentation account (a normal user) and the friend who saved the same headphones.
// The account must exist first: sign up once in the app with this email.
const PRESENTER_EMAIL = 'fastdealdemo1@gmail.com'
const PRESENTER_FRIEND = 'zoedharmadi.2024@smu.edu.sg'
// Its Telegram username is Marvel's, so "Message" on the invite opens Marvel's chat, as in the scenario
const PRESENTER_TELEGRAM_FROM = 'm.tedjakus@gmail.com'
// The Sony listing the presenter opens: the cheapest one in the demo search "Sony WH-1000XM5 wireless
// headphones". The friend saved it, so Buy Together shows when the presenter's Sleep on it ends.
const SCENARIO_PRODUCT = '17755277695162489284'
const SCENARIO_QUERY = 'Sony WH-1000XM5 wireless headphones'
// Already on the presenter's wishlist, from the demo searches, for Plan a budget and the target price:
// the cheapest Owala, a Kindle and the cheapest Nespresso. The friend saved none of these.
const PRESENTER_ITEMS = [
  { productId: '4133118681708311535', q: 'Owala bottle' },
  { productId: '519652814591809605', q: 'Kindle Paperwhite' },
  { productId: '4782649891617645591', q: 'Nespresso Capsules 50 Pack' }
]

// What demo does with each product, by its place in demo-products.json:
// 2 Sleep on it still counting down, 3 Sleep on it ended (purchase verdict waiting), 4 a target price.
// The target is on the newest product: it is the first row on the wishlist, and the target price
// tests change that row's target and then put the old value back.
const SLEEPING_INDEX = 2
const SLEEP_ENDED_INDEX = 3
const TARGET_INDEX = 4

// One demo search listing with its product page title: the name the product page saves it under
function demoListing(productId) {
  for (const search of demo.searches) {
    const listing = search.listings.find(function (row) { return row.productId === productId })
    if (listing) {
      const page = demo.pages.find(function (row) { return row.productId === productId })
      return { listing: listing, name: page ? page.title : listing.name, image: (page && page.image) || listing.image || '' }
    }
  }
  return null
}

// The presentation account, ready for the scenario: logged-in shopper "fastdealdemo" with 3 saved
// products, no Sony yet, Zoe as the only friend, a Telegram username, and nothing else.
// Zoe has the scenario's Sony headphones saved. Returns a line for the log.
async function seedPresenter() {
  const presenter = await User.findOne({ email: PRESENTER_EMAIL }).lean()
  if (!presenter) {
    return PRESENTER_EMAIL + ' does not exist yet, so the presentation account was skipped.'
  }
  const uid = presenter.firebaseUid
  const friend = await User.findOne({ email: PRESENTER_FRIEND }).lean()
  const telegramFrom = await User.findOne({ email: PRESENTER_TELEGRAM_FROM }).select('telegramUsername').lean()

  // Start clean: no saved products, holds, friends, notifications, budgets or recent searches
  await WishlistItem.deleteMany({ firebaseUid: uid })
  await SleepHold.deleteMany({ firebaseUid: uid })
  await Friendship.deleteMany({ $or: [{ requesterUid: uid }, { addresseeUid: uid }] })
  await Notification.deleteMany({ $or: [{ firebaseUid: uid }, { fromUid: uid }] })
  await User.updateOne({ firebaseUid: uid }, {
    $set: {
      username: 'fastdealdemo',
      role: 'user',
      emailAlertsOn: true,
      telegramUsername: (telegramFrom && telegramFrom.telegramUsername) || null,
      budgetDrafts: [],
      recentSearches: []
    }
  })

  const now = Date.now()
  const items = []
  PRESENTER_ITEMS.forEach(function (item, i) {
    const found = demoListing(item.productId)
    if (!found) return
    items.push({
      firebaseUid: uid,
      productName: found.name,
      productKey: toProductKey(found.name),
      productId: item.productId,
      q: item.q,
      image: found.image,
      savedPrice: found.listing.price,
      savedStore: found.listing.store,
      priority: i + 1,
      savedAt: new Date(now - (PRESENTER_ITEMS.length - i) * DAY)
    })
  })
  await WishlistItem.insertMany(items)

  const sony = demoListing(SCENARIO_PRODUCT)
  if (!friend || !sony) {
    return 'Presentation account set up with ' + items.length + ' saved products, but ' + PRESENTER_FRIEND +
      ' or the Sony listing is missing, so there is no friend.'
  }
  await Friendship.create({
    requesterUid: uid,
    addresseeUid: friend.firebaseUid,
    pairKey: toPairKey(uid, friend.firebaseUid),
    status: 'accepted',
    createdAt: new Date(now - 3 * DAY),
    respondedAt: new Date(now - 3 * DAY + 2 * HOUR)
  })
  // Zoe's own save of the Sony headphones. Only added if she does not have it, so her other data stays.
  const friendCount = await WishlistItem.countDocuments({ firebaseUid: friend.firebaseUid })
  await WishlistItem.updateOne(
    { firebaseUid: friend.firebaseUid, productKey: toProductKey(sony.name) },
    {
      $setOnInsert: {
        productName: sony.name,
        productId: SCENARIO_PRODUCT,
        q: SCENARIO_QUERY,
        image: sony.image,
        savedPrice: sony.listing.price,
        savedStore: sony.listing.store,
        priority: friendCount + 1,
        savedAt: new Date(now - 2 * DAY)
      }
    },
    { upsert: true }
  )
  return 'Presentation account fastdealdemo: ' + items.length + ' saved products, friend ' + friend.username +
    ' (has "' + sony.name + '" saved), Telegram ' + ((telegramFrom && telegramFrom.telegramUsername) || 'not set') + '.'
}

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

    // Demo searches and their product pages, pinned in the cache (demo: true) until DEMO_UNTIL.
    // Old demo rows go first, so a page that left the demo searches is fetched live again.
    await SearchCache.deleteMany({ demo: true })
    await ProductCache.deleteMany({ demo: true })
    await SearchCache.bulkWrite(demo.searches.map(function (row) {
      return {
        updateOne: {
          filter: { queryKey: row.queryKey },
          update: { $set: Object.assign({}, row, { demo: true, expiresAt: DEMO_UNTIL }) },
          upsert: true
        }
      }
    }))
    await ProductCache.bulkWrite(demo.pages.map(function (row) {
      return {
        updateOne: {
          filter: { productId: row.productId },
          update: { $set: Object.assign({}, row, { demo: true, expiresAt: DEMO_UNTIL }) },
          upsert: true
        }
      }
    }))

    // Price history: 30 days for every listing in the demo searches and every wishlist product.
    // Old seed rows go first.
    await PriceDay.deleteMany({ source: 'seed' })
    // A wishlist product that is also a listing in a demo search keeps the listing's history.
    let history = []
    let shift = 0
    const seeded = []
    for (const row of demo.searches) {
      for (const listing of row.listings) {
        history = history.concat(historyRows(listing.productId, listing.store, listing.price, shift++))
        seeded.push(listing.productId)
      }
    }
    for (const product of products) {
      if (seeded.indexOf(product.productId) !== -1) continue
      history = history.concat(historyRows(product.productId, product.store, product.price, shift++))
    }
    await PriceDay.bulkWrite(history, { ordered: false })

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

    // Buy Together: friends who really saved one of the demo products. Nothing is made up: if no
    // friend saved a demo product, no Buy Together notification is added.
    const demoKeys = products.map(function (product) { return toProductKey(product.name) })
    const friendUids = friends.map(function (friend) { return friend.firebaseUid })
    const friendItems = await WishlistItem.find({
      firebaseUid: { $in: friendUids },
      productKey: { $in: demoKeys }
    }).select('firebaseUid productKey productName').lean()

    const sleepEnded = products[SLEEP_ENDED_INDEX]
    const sleepEndedKey = toProductKey(sleepEnded.name)

    // The product whose Sleep on it ended: one "Buy together?" alert naming the friends who saved it
    const names = []
    for (const item of friendItems) {
      if (item.productKey !== sleepEndedKey) continue
      for (const friend of friends) {
        if (friend.firebaseUid === item.firebaseUid && names.indexOf(friend.username) === -1) names.push(friend.username)
      }
    }
    let buyTogetherCount = 0
    if (names.length) {
      notifications.push({
        firebaseUid: uid,
        type: 'group-order',
        title: 'Buy together?',
        body: names.join(', ') + ' also saved ' + sleepEnded.name + '. Order together to split the shipping.',
        link: '/notifications',
        productKey: sleepEndedKey,
        createdAt: new Date(now - 2 * HOUR)
      })
      buyTogetherCount++
    }

    // Any other shared product: one friend per product invites demo to buy it together
    const invitedKeys = []
    for (const item of friendItems) {
      if (item.productKey === sleepEndedKey || invitedKeys.indexOf(item.productKey) !== -1 || buyTogetherCount >= 4) continue
      invitedKeys.push(item.productKey)
      for (const friend of friends) {
        if (friend.firebaseUid !== item.firebaseUid) continue
        notifications.push({
          firebaseUid: uid,
          type: 'group-invite',
          title: friend.username + ' wants to buy together!',
          body: friend.username + ' saved ' + item.productName + ' and wants to split the shipping.',
          link: '/notifications',
          productKey: item.productKey,
          fromUid: friend.firebaseUid,
          createdAt: new Date(now - (buyTogetherCount + 1) * 3 * HOUR)
        })
        buyTogetherCount++
      }
    }
    await Notification.insertMany(notifications)

    console.log(
      'Seeded demo with ' + products.length + ' wishlist items, ' + demo.searches.length + ' demo searches, ' +
        demo.pages.length + ' demo product pages, ' + history.length + ' price history days, ' +
        friends.length + ' friends, ' +
        (requester ? 1 : 0) + ' friend request and ' + notifications.length + ' notifications (' +
        buyTogetherCount + ' about Buy Together)' +
        (demoUserUid ? '. demo.user is clean.' : '. DEMO_USER_FIREBASE_UID is not set, so demo.user was skipped.')
    )
    console.log(await seedPresenter())
  } catch (error) {
    console.error('Seed failed:', error.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

seed()
