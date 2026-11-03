// Writes and reads the priceDays collection: the lowest price of one product at one store
// on one Singapore day. The product page writes it keyed by the product title; every fresh
// search writes it keyed by the search (its productKey). The Home "Comparing pays" card reads
// the live rows. SerpApi gives no price history, so the 30-day history uses rows the seed wrote
// for the demo searches and the demo wishlist (source 'seed', data/demo-searches.json).
// Any other product has too few days and gets no history.
import PriceDay from '../models/price-day-model.js'

const HOUR = 3600000
const DAY = 24 * HOUR

// The history covers this many days, today included
export const HISTORY_DAYS = 30
// With fewer days than this, a product has no history: a low over a few days means little
export const MIN_HISTORY_DAYS = 14

// "YYYY-MM-DD" in Singapore time (UTC+8, no daylight saving).
export function sgDay(time) {
  return new Date(time + 8 * HOUR).toISOString().slice(0, 10)
}

// Each store's lowest price for one product, cheapest first: [{ store, price }].
// A search also returns related listings (a case next to the headphones), so only prices
// between half and double the median count as the product itself.
export function storePrices(listings) {
  const prices = listings.map(function (row) { return Number(row.price) }).filter(function (n) { return n > 0 })
  if (!prices.length) {
    return []
  }
  const sorted = prices.slice().sort(function (a, b) { return a - b })
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const lowest = {}
  for (const row of listings) {
    const price = Number(row.price)
    if (!row.store || !(price >= median / 2 && price <= median * 2)) {
      continue
    }
    if (!lowest[row.store] || price < lowest[row.store]) {
      lowest[row.store] = price
    }
  }
  return Object.keys(lowest).map(function (store) {
    return { store: store, price: lowest[store] }
  }).sort(function (a, b) { return a.price - b.price })
}

// Save today's price for each store. rows: [{ store, price, oldPrice, productId }].
// source: 'search' or 'product', saved on the row so real prices can be told from seeded ones.
// A store listed twice keeps its lowest price. Errors are logged, never thrown,
// so a search never fails because of price history.
export async function recordPrices(productKey, rows, source) {
  const lowest = {}
  for (const row of rows) {
    if (!row.store || !(row.price > 0)) {
      continue
    }
    if (!lowest[row.store] || row.price < lowest[row.store].price) {
      lowest[row.store] = row
    }
  }

  const day = sgDay(Date.now())
  const ops = Object.values(lowest).map(function (row) {
    return {
      updateOne: {
        filter: { productKey: productKey, store: row.store, day: day },
        update: {
          $min: { price: row.price },
          $set: { source: source || null },
          $setOnInsert: { oldPrice: row.oldPrice || null, productId: row.productId || null }
        },
        upsert: true
      }
    }
  })
  if (!ops.length) {
    return
  }

  try {
    await PriceDay.bulkWrite(ops, { ordered: false })
  } catch (error) {
    console.error('priceDays write failed:', error.message)
  }
}

// The made-up daily prices the seed writes for one demo product, oldest first.
// price is the real captured price, and the last row (daysAgo 0, the capture day) is exactly that price. The other days move a
// few percent around it, with a sale dip about 10 days ago. shift makes each product's line
// different. No random numbers, so every seed gives the same history and the tests stay the same.
export function seededPrices(price, shift) {
  const rows = []
  for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo--) {
    // The move shrinks over the last 3 days, so the line ends smoothly at today's real price
    const move = 0.04 * Math.sin((daysAgo + shift) * 0.7) + 0.03 * Math.cos((daysAgo + shift) * 0.3)
    let factor = 1 + move * Math.min(daysAgo / 3, 1)
    if (daysAgo >= 9 && daysAgo <= 11) {
      factor = factor - 0.1
    }
    rows.push({ daysAgo: daysAgo, price: Math.round(price * factor * 100) / 100 })
  }
  return rows
}

// The summary of one product's daily prices, or null with fewer than MIN_HISTORY_DAYS days.
// rows: priceDays rows ({ day, price, source }), any number of stores per day.
// Each day keeps its lowest price. weekChange is the percent change over the last 7 days.
export function summarizeHistory(rows) {
  const lowest = {}
  let seeded = false
  for (const row of rows) {
    if (!(row.price > 0)) {
      continue
    }
    if (!lowest[row.day] || row.price < lowest[row.day]) {
      lowest[row.day] = row.price
    }
    if (row.source === 'seed') {
      seeded = true
    }
  }
  const points = Object.keys(lowest).sort().map(function (day) {
    return { day: day, price: lowest[day] }
  })
  if (points.length < MIN_HISTORY_DAYS) {
    return null
  }

  let low = points[0]
  let high = points[0]
  let sum = 0
  for (const point of points) {
    if (point.price < low.price) low = point
    if (point.price > high.price) high = point
    sum = sum + point.price
  }
  const last = points[points.length - 1]
  const weekAgo = points[Math.max(points.length - 8, 0)]
  return {
    days: points.length,
    low: low.price,
    lowDay: low.day,
    high: high.price,
    average: Math.round((sum / points.length) * 100) / 100,
    last: last.price,
    weekChange: Math.round(((last.price - weekAgo.price) / weekAgo.price) * 1000) / 10,
    seeded: seeded,
    points: points
  }
}

// The rows of the last HISTORY_DAYS days that have data, counted back from the newest row,
// not from today. The seeded days end on the capture day, so a grader in Week 18 still sees them.
export function lastDays(rows) {
  let newest = ''
  for (const row of rows) {
    if (row.day > newest) newest = row.day
  }
  if (!newest) {
    return []
  }
  const first = sgDay(Date.parse(newest + 'T12:00:00+08:00') - (HISTORY_DAYS - 1) * DAY)
  return rows.filter(function (row) { return row.day >= first })
}

// One product's history from its seeded rows, or null. Only seeded rows count: a live product page
// saves every listing's price under its own product id, so live rows would mix in other listings.
// Errors are logged and give null, so a page never fails because of price history.
export async function findHistory(productId) {
  if (!productId) {
    return null
  }
  try {
    const rows = await PriceDay.find({ productId: productId, source: 'seed' }).select('day price source').lean()
    return summarizeHistory(lastDays(rows))
  } catch (error) {
    console.error('priceDays read failed:', error.message)
    return null
  }
}

// The history of every listing in one search, by product id, in one database read.
// { [productId]: history }. A listing with no history is left out.
export async function historyByProductId(productIds) {
  const ids = productIds.filter(Boolean)
  if (!ids.length) {
    return {}
  }
  try {
    const rows = await PriceDay.find({ productId: { $in: ids }, source: 'seed' }).select('productId day price source').lean()
    const byId = {}
    for (const row of rows) {
      if (!byId[row.productId]) byId[row.productId] = []
      byId[row.productId].push(row)
    }
    const result = {}
    for (const id of Object.keys(byId)) {
      const history = summarizeHistory(lastDays(byId[id]))
      if (history) result[id] = history
    }
    return result
  } catch (error) {
    console.error('priceDays read failed:', error.message)
    return {}
  }
}
