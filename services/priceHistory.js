// Writes the priceDays collection: the lowest price of one product at one store
// on one Singapore day. Only the product page writes it, keyed by the product title.
import PriceDay from '../models/price-day-model.js'

const HOUR = 3600000

// "YYYY-MM-DD" in Singapore time (UTC+8, no daylight saving).
export function sgDay(time) {
  return new Date(time + 8 * HOUR).toISOString().slice(0, 10)
}

// Save today's price for each store. rows: [{ store, price, oldPrice, productId }].
// A store listed twice keeps its lowest price. Errors are logged, never thrown,
// so a search never fails because of price history.
export async function recordPrices(productKey, rows) {
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
