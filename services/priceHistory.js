// Writes the priceDays collection: the lowest price of one product at one store
// on one Singapore day. The product page writes it keyed by the product title; every fresh
// search writes it keyed by the search (its productKey), which builds the Home price tracking.
import PriceDay from '../models/price-day-model.js'

const HOUR = 3600000

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
