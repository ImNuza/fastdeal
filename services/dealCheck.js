// Deal check for one product: how each store's price compares with the other stores
// that sell the same product today, and whether a store sale is coming.
// Plain functions with no database calls, so they are easy to test.
import { SALE_EVENTS, STORE_SALES } from '../data/sale-calendar.js'
import { sgDay } from './priceHistory.js'

const DAY = 24 * 3600000

// With fewer stores than this, a typical price means little
const MIN_STORES = 3
// A store's total divided by the typical price decides its label:
// below MUCH_CHEAPER "Much cheaper", below GOOD "Good price", up to TYPICAL "Typical price",
// up to FAR_ABOVE "Above typical", over FAR_ABOVE "Far above typical".
// A judgement call, not a standard. Tune here.
const MUCH_CHEAPER = 0.5
const GOOD = 0.9
const TYPICAL = 1.15
const FAR_ABOVE = 2
// Only mention a sale that starts within this many days
const SALE_WINDOW = 45

function sgd(n) {
  return 'S$' + Number(n).toFixed(2)
}

function median(numbers) {
  const sorted = numbers.slice().sort(function (a, b) {
    return a - b
  })
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// The middle total of all stores (one row per store), or null with too few stores.
export function typicalPrice(stores) {
  if (stores.length < MIN_STORES) {
    return null
  }
  return median(stores.map(function (row) {
    return row.total
  }))
}

// How one store's total compares with the typical price.
export function priceLabel(store, typical, storeCount) {
  if (!typical) {
    return {
      label: 'Too few stores to compare',
      tone: 'muted',
      detail: 'Only ' + storeCount + (storeCount === 1 ? ' store sells' : ' stores sell') + ' it today.'
    }
  }

  const ratio = store.total / typical
  const percent = Math.round(Math.abs(1 - ratio) * 100)
  if (ratio < MUCH_CHEAPER) {
    return {
      label: 'Much cheaper than other stores',
      tone: 'warn',
      detail: percent + '% below the typical ' + sgd(typical) + '. Check the seller\'s reviews before you buy.'
    }
  }
  if (ratio < GOOD) {
    return { label: 'Good price', tone: 'good', detail: percent + '% below the typical ' + sgd(typical) + '.' }
  }
  if (ratio <= TYPICAL) {
    return { label: 'Typical price', tone: 'muted', detail: 'Close to the typical ' + sgd(typical) + '.' }
  }
  if (ratio <= FAR_ABOVE) {
    return { label: 'Above typical', tone: 'bad', detail: percent + '% above the typical ' + sgd(typical) + '.' }
  }
  return {
    label: 'Far above typical',
    tone: 'bad',
    detail: 'More than twice the typical ' + sgd(typical) + '. Often an overseas seller or a bundle.'
  }
}

// Is the store's crossed-out "was" price believable? Null when it shows none.
// Inflated = no other store charges that much today. Stores far above the typical
// price (overseas sellers, bundles) do not count, or any was price would look fine.
export function wasPriceLabel(store, stores, typical) {
  if (!store.oldPrice || store.oldPrice <= store.price) {
    return null
  }
  const others = stores.filter(function (row) {
    return row.store !== store.store && (!typical || row.total <= typical * FAR_ABOVE)
  })
  if (!others.length) {
    return null
  }

  const highest = Math.max.apply(null, others.map(function (row) {
    return row.price
  }))
  if (store.oldPrice > highest) {
    return {
      label: 'Was price looks inflated',
      tone: 'bad',
      detail: 'No other store charges ' + sgd(store.oldPrice) + '. The highest is ' + sgd(highest) + '.'
    }
  }
  return {
    label: 'Was price matches other stores',
    tone: 'good',
    detail: 'Other stores charge up to ' + sgd(highest) + ' today.'
  }
}

// Whole days from today (Singapore) to the next month/day.
function daysUntil(today, month, day) {
  let year = Number(today.slice(0, 4))
  const mmdd = String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
  if (year + '-' + mmdd < today) {
    year = year + 1
  }
  return Math.round((Date.parse(year + '-' + mmdd) - Date.parse(today)) / DAY)
}

// The next sale this store usually joins, or null if the store is unknown
// or no sale starts within SALE_WINDOW days.
export function saleSoon(store, now) {
  const name = String(store || '').toLowerCase()
  const entry = STORE_SALES.find(function (row) {
    return name.includes(row.match)
  })
  if (!entry) {
    return null
  }

  const today = sgDay(now)
  let next = null
  for (const id of entry.events) {
    const event = SALE_EVENTS.find(function (row) {
      return row.id === id
    })
    const days = daysUntil(today, event.month, event.day)
    if (!next || days < next.days) {
      next = { event: event.name, big: event.big, days: days }
    }
  }
  if (!next || next.days > SALE_WINDOW) {
    return null
  }

  const when = next.days === 0 ? 'today' : next.days === 1 ? 'tomorrow' : 'in ' + next.days + ' days'
  return {
    event: next.event,
    big: next.big,
    days: next.days,
    text: entry.label + ' usually runs the ' + next.event + ' ' + when + '. Not guaranteed.'
  }
}

// All checks for one store. stores: every store for this product, one row per store.
export function dealCheck(store, stores, typical, now) {
  return {
    price: priceLabel(store, typical, stores.length),
    was: wasPriceLabel(store, stores, typical),
    sale: saleSoon(store.store, now)
  }
}
