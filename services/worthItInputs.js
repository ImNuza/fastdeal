// What the AI "Worth it?" verdict reads, as rows a person can check in the
// "How the AI decided" pop-up on the product page.
// Every row comes from data the product page already shows: the listings from the shopper's search,
// the one they picked, and the sale calendar. So the verdict and the list on the page always agree.
// There is no price history: SerpApi does not give one, and a product the shopper searches for the
// first time would have none.
// Pure functions: no database and no network, so they are unit tested in services/__tests__.

const LIVE = 'Live search listings (SerpApi)'
const CALENDAR = 'FastDeal sale calendar'

function money(n) {
  return 'S$' + Number(n).toFixed(2)
}

// "2026-11-11" as "11 Nov"
function dayText(day) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const parts = String(day).split('-')
  return Number(parts[2]) + ' ' + months[Number(parts[1]) - 1]
}

// ', listed as "Apple iPhone 16 Plus"', since a listing can be a different model. Empty with no name.
function listedAs(row) {
  return row.name ? ', listed as "' + row.name + '"' : ''
}

// The listings with a price, the shopper's pick (the listing clicked on Compare, else the cheapest),
// the cheapest and the priciest. null when no listing has a price.
function priced(product) {
  const stores = (product.stores || []).filter(function (row) { return row.total > 0 })
  if (!stores.length) return null
  let cheapest = stores[0]
  let highest = stores[0]
  for (const row of stores) {
    if (row.total < cheapest.total) cheapest = row
    if (row.total > highest.total) highest = row
  }
  const pick = product.pick && product.pick.total > 0 ? product.pick : cheapest
  return { stores: stores, pick: pick, cheapest: cheapest, highest: highest }
}

// product: from getProduct (services/productService.js). Its stores are the listings from the
// shopper's search (the same ones Compare shows), and pick is the listing they clicked.
// sale: the next big sale ({ name, day, daysAway }) or null.
// Returns { rows, summary }. Each row is { key, label, value, source, sent }: sent is false when
// the data is missing, and that row is left out of the prompt.
export function verdictInputs(product, sale) {
  const rows = []

  rows.push({ key: 'product', label: 'Product', value: product.title, source: LIVE, sent: true })

  const prices = priced(product)
  if (!prices) {
    return { rows: rows, summary: '' }
  }
  const { stores, pick, cheapest, highest } = prices
  const count = stores.length + (stores.length === 1 ? ' listing' : ' listings')

  rows.push({
    key: 'pick', label: 'Your pick', source: LIVE, sent: true,
    value: money(pick.total) + ' at ' + pick.store + listedAs(pick)
  })

  rows.push({
    key: 'cheapest', label: 'Cheapest listing', source: LIVE, sent: true,
    value: money(cheapest.total) + ' at ' + cheapest.store + listedAs(cheapest)
  })

  const typical = product.typicalPrice
  rows.push(typical
    ? { key: 'typical', label: 'Usual price', source: LIVE, sent: true,
        value: money(typical) + ', the middle price of ' + count }
    : { key: 'typical', label: 'Usual price', source: LIVE, sent: false,
        value: 'Fewer than 3 listings, so there is no usual price' })

  rows.push({
    key: 'range', label: 'Price range', source: LIVE, sent: true,
    value: money(cheapest.total) + ' to ' + money(highest.total) + ' across ' + count
  })

  const onSale = stores.filter(function (row) { return row.oldPrice > row.price })
  rows.push({
    key: 'sale-now', label: 'Listings showing a sale price', source: LIVE, sent: true,
    value: onSale.length
      ? onSale.slice(0, 3).map(function (row) {
        return row.store + ' (was ' + money(row.oldPrice) + ', now ' + money(row.price) + ')'
      }).join('; ')
      : 'No listing shows a "was" price'
  })

  rows.push(product.rating
    ? { key: 'rating', label: 'Rating', source: LIVE, sent: true,
        value: Number(product.rating).toFixed(1) + ' out of 5 from ' + (product.reviews || 0) + ' reviews' }
    : { key: 'rating', label: 'Rating', source: LIVE, sent: false, value: 'No rating on the product page' })

  rows.push(sale
    ? { key: 'next-sale', label: 'Next big sale', source: CALENDAR, sent: true,
        value: sale.name + ' on ' + dayText(sale.day) + ', in ' + sale.daysAway + (sale.daysAway === 1 ? ' day' : ' days') }
    : { key: 'next-sale', label: 'Next big sale', source: CALENDAR, sent: false, value: 'No sale found' })

  let summary = 'Your pick ' + money(pick.total)
  summary += pick.total <= cheapest.total ? ' (the cheapest)' : ', cheapest ' + money(cheapest.total)
  if (typical) summary += ', usual ' + money(typical)
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
    'Facts from FastDeal (prices in SGD, from the listings in the shopper\'s Google Shopping search today. ' +
    'A listing can be a different model, size or condition from the shopper\'s pick):\n' +
    facts + '\n\n' +
    'Decide whether the shopper should BUY NOW at the price of their pick, or WAIT for the next big sale.\n' +
    'Use only the facts above. Compare the pick with the cheapest listing, the usual price and the price range. ' +
    'A listing with a "was" price is already on sale. ' +
    'Do not invent past prices, discounts or sale dates that are not in the facts.\n\n' +
    'Return JSON only, in exactly this shape:\n' +
    '{"decision": "buy" | "wait", "headline": string (max 6 words), ' +
    '"reason": string (max 35 words, and name at least one number from the facts)}'
  )
}

// The answer when both Gemini models fail: fixed rules on the same live numbers, so the page never
// shows an empty verdict. source 'rules' tells the page to say that the AI did not answer.
// A pick 10% or more under the typical price is a buy, and 10% or more over it is a wait.
// Otherwise, a big sale within SALE_SOON_DAYS days is worth the wait.
// With fewer than 3 listings there is no typical price.
const SALE_SOON_DAYS = 14

export function ruleVerdict(product, sale) {
  const prices = priced(product)
  if (!prices) return null
  const { stores, pick } = prices
  const typical = product.typicalPrice
  const saleSoon = sale && sale.daysAway <= SALE_SOON_DAYS
  const saleName = sale ? sale.name.replace(/ sale$/, '') : ''
  const days = sale ? sale.daysAway + (sale.daysAway === 1 ? ' day' : ' days') : ''

  if (typical && pick.total <= typical * 0.9) {
    const below = Math.round((1 - pick.total / typical) * 100)
    return {
      decision: 'buy', headline: 'Good price now', source: 'rules',
      reason: 'Your pick ' + money(pick.total) + ' is ' + below + '% under the usual ' +
        money(typical) + ' across ' + stores.length + ' listings.'
    }
  }
  if (typical && pick.total >= typical * 1.1) {
    const above = Math.round((pick.total / typical - 1) * 100)
    return {
      decision: 'wait', headline: 'Above the usual price', source: 'rules',
      reason: 'Your pick ' + money(pick.total) + ' is ' + above + '% over the usual ' + money(typical) +
        ' across ' + stores.length + ' listings. Check the cheaper listings below.'
    }
  }
  if (saleSoon) {
    return {
      decision: 'wait', headline: 'Wait for ' + saleName, source: 'rules',
      reason: (typical
        ? 'Your pick ' + money(pick.total) + ' is not under the usual ' + money(typical) + '.'
        : 'Only ' + stores.length + (stores.length === 1 ? ' listing has' : ' listings have') + ' a price, so there is no usual price.') +
        ' The ' + saleName + ' sale is in ' + days + '.'
    }
  }
  if (typical) {
    return {
      decision: 'buy', headline: 'Fair price', source: 'rules',
      reason: 'Your pick ' + money(pick.total) + ' is close to the usual ' + money(typical) +
        (sale ? ', and the next big sale is ' + days + ' away.' : '.')
    }
  }
  return null
}
