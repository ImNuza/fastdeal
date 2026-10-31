// What the AI "Worth it?" verdict reads, as rows a person can check on the
// "How this verdict was made" page (/product/:productId/worth-it).
// Every row comes from data the product page already has, so a niche product nobody searched
// before still gets a verdict built on real numbers. Price history is used only when FastDeal
// has tracked 3 or more days of it.
// Pure functions: no database and no network, so they are unit tested in services/__tests__.

const LIVE = 'Live store prices (SerpApi)'
const CALENDAR = 'FastDeal sale calendar'
const HISTORY = 'FastDeal price history'

// Same as the compare page verdict: fewer days than this says nothing about a trend.
export const MIN_HISTORY_DAYS = 3

function money(n) {
  return 'S$' + Number(n).toFixed(2)
}

// "2026-11-11" as "11 Nov"
function dayText(day) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const parts = String(day).split('-')
  return Number(parts[2]) + ' ' + months[Number(parts[1]) - 1]
}

// product: from getProduct (services/productService.js). history: [{ day, price }] for this product.
// sale: the next big sale ({ name, day, daysAway }) or null.
// Returns { rows, summary }. Each row is { key, label, value, source, sent }: sent is false when
// the data is missing, and that row is left out of the prompt.
export function verdictInputs(product, history, sale) {
  const stores = (product.stores || []).filter(function (row) { return row.total > 0 })
  const rows = []

  rows.push({ key: 'product', label: 'Product', value: product.title, source: LIVE, sent: true })

  if (!stores.length) {
    return { rows: rows, summary: '' }
  }

  let cheapest = stores[0]
  let highest = stores[0]
  for (const row of stores) {
    if (row.total < cheapest.total) cheapest = row
    if (row.total > highest.total) highest = row
  }
  const count = stores.length + (stores.length === 1 ? ' store' : ' stores')

  rows.push({
    key: 'cheapest', label: 'Cheapest total now', source: LIVE, sent: true,
    value: money(cheapest.total) + ' at ' + cheapest.store
  })

  const typical = product.typicalPrice
  rows.push(typical
    ? { key: 'typical', label: 'Typical price', source: LIVE, sent: true,
        value: money(typical) + ', the middle total of ' + count }
    : { key: 'typical', label: 'Typical price', source: LIVE, sent: false,
        value: 'Fewer than 3 stores, so there is no typical price' })

  rows.push({
    key: 'range', label: 'Price range', source: LIVE, sent: true,
    value: money(cheapest.total) + ' to ' + money(highest.total) + ' across ' + count
  })

  const onSale = stores.filter(function (row) { return row.oldPrice > row.price })
  rows.push({
    key: 'sale-now', label: 'Stores showing a sale price', source: LIVE, sent: true,
    value: onSale.length
      ? onSale.slice(0, 3).map(function (row) {
        return row.store + ' (was ' + money(row.oldPrice) + ', now ' + money(row.price) + ')'
      }).join('; ')
      : 'No store shows a "was" price'
  })

  rows.push(product.rating
    ? { key: 'rating', label: 'Rating', source: LIVE, sent: true,
        value: Number(product.rating).toFixed(1) + ' out of 5 from ' + (product.reviews || 0) + ' reviews' }
    : { key: 'rating', label: 'Rating', source: LIVE, sent: false, value: 'No rating on the product page' })

  rows.push(sale
    ? { key: 'next-sale', label: 'Next big sale', source: CALENDAR, sent: true,
        value: sale.name + ' on ' + dayText(sale.day) + ', in ' + sale.daysAway + (sale.daysAway === 1 ? ' day' : ' days') }
    : { key: 'next-sale', label: 'Next big sale', source: CALENDAR, sent: false, value: 'No sale found' })

  const days = (history || []).length
  if (days >= MIN_HISTORY_DAYS) {
    let low = history[0].price
    let sum = 0
    for (const row of history) {
      if (row.price < low) low = row.price
      sum += row.price
    }
    rows.push({
      key: 'history', label: 'Price history', source: HISTORY, sent: true,
      value: 'Low ' + money(low) + ', average ' + money(sum / days) + ' over ' + days + ' tracked days'
    })
  } else {
    rows.push({
      key: 'history', label: 'Price history', source: HISTORY, sent: false,
      value: (days ? days + (days === 1 ? ' tracked day' : ' tracked days') : 'No tracked days yet') +
        '. It needs ' + MIN_HISTORY_DAYS + ', so it was not sent'
    })
  }

  let summary = 'Cheapest ' + money(cheapest.total)
  if (typical) summary += ', typical ' + money(typical)
  if (onSale.length) summary += ', ' + onSale.length + ' on sale now'
  if (sale) summary += ', ' + sale.name.replace(/ sale$/, '') + ' in ' + sale.daysAway + (sale.daysAway === 1 ? ' day' : ' days')
  return { rows: rows, summary: summary + '.' }
}

// The exact text sent to Gemini: only the rows that were sent, then the task and the answer shape.
export function verdictPrompt(rows) {
  const facts = rows
    .filter(function (row) { return row.sent })
    .map(function (row) { return '- ' + row.label + ': ' + row.value })
    .join('\n')
  return (
    'You are a shopping adviser for Singapore shoppers.\n' +
    'Facts from FastDeal (prices in SGD, from stores that sell this product today):\n' +
    facts + '\n\n' +
    'Decide whether the shopper should BUY NOW at the cheapest total, or WAIT for the next big sale.\n' +
    'Use only the facts above. Compare the cheapest total with the typical price and the price range. ' +
    'A store with a "was" price is already on sale. ' +
    'Do not invent past prices, discounts or sale dates that are not in the facts.\n\n' +
    'Return JSON only, in exactly this shape:\n' +
    '{"decision": "buy" | "wait", "headline": string (max 6 words), ' +
    '"reason": string (max 35 words, and name at least one number from the facts)}'
  )
}
