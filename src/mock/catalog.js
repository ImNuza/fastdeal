const stores = ['Shopee', 'Lazada', 'Amazon.sg', 'Courts', 'Best Denki', 'Challenger', 'Qoo10', 'iShopChangi']

export const catalog = [
  {
    name: 'Sony WH-1000XM5',
    aliases: ['xm5', 'sony', 'headphone', 'wh-1000'],
    related: ['Apple AirPods Pro 2', 'Bose QuietComfort Ultra'],
    history: [489, 479, 469, 459, 449, 419, 449, 439, 429, 439, 449, 435, 441, 429],
    listings: [
      { store: 'Shopee', price: 429, rating: 4.7, reviews: 3201, freeShipping: true, onSale: true },
      { store: 'Lazada', price: 439, rating: 4.4, reviews: 1802, freeShipping: false, onSale: true },
      { store: 'Amazon.sg', price: 449, rating: 4.6, reviews: 2104, freeShipping: true, onSale: false },
      { store: 'Courts', price: 459, rating: 4.5, reviews: 640, freeShipping: true, onSale: false },
      { store: 'Best Denki', price: 469, rating: 4.4, reviews: 210, freeShipping: true, onSale: false },
      { store: 'Challenger', price: 489, rating: 4.2, reviews: 96, freeShipping: false, onSale: false }
    ]
  },
  {
    name: 'Apple AirPods Pro 2',
    aliases: ['airpod', 'airpods'],
    related: ['Sony WH-1000XM5', 'Bose QuietComfort Ultra'],
    history: [289, 279, 299, 309, 319, 305, 299, 289, 295, 309, 319, 329, 315, 319],
    listings: [
      { store: 'Shopee', price: 319, rating: 4.5, reviews: 4100, freeShipping: true, onSale: true },
      { store: 'Lazada', price: 329, rating: 4.3, reviews: 2200, freeShipping: false, onSale: true },
      { store: 'Amazon.sg', price: 339, rating: 4.6, reviews: 1500, freeShipping: true, onSale: false },
      { store: 'Courts', price: 349, rating: 4.4, reviews: 400, freeShipping: true, onSale: false },
      { store: 'iShopChangi', price: 359, rating: 4.7, reviews: 180, freeShipping: true, onSale: false }
    ]
  },
  {
    name: 'Nintendo Switch OLED',
    aliases: ['switch', 'nintendo'],
    related: ['Kindle Paperwhite', 'Sony WH-1000XM5'],
    history: [459, 449, 439, 429, 419, 410, 429, 439, 449, 435, 429, 425, 419, 419],
    listings: [
      { store: 'Shopee', price: 419, rating: 4.5, reviews: 3000, freeShipping: true, onSale: true },
      { store: 'Amazon.sg', price: 429, rating: 4.6, reviews: 800, freeShipping: true, onSale: false },
      { store: 'Courts', price: 449, rating: 4.3, reviews: 150, freeShipping: false, onSale: false },
      { store: 'Qoo10', price: 439, rating: 4.2, reviews: 540, freeShipping: true, onSale: true },
      { store: 'Best Denki', price: 459, rating: 4.4, reviews: 90, freeShipping: true, onSale: false }
    ]
  },
  {
    name: 'Kindle Paperwhite',
    aliases: ['kindle', 'paperwhite'],
    related: ['Nintendo Switch OLED', 'Sony WH-1000XM5'],
    history: [219, 209, 205, 199, 195, 186, 199, 205, 199, 195, 189, 195, 199, 189],
    listings: [
      { store: 'Amazon.sg', price: 189, rating: 4.7, reviews: 5000, freeShipping: true, onSale: true },
      { store: 'Shopee', price: 199, rating: 4.5, reviews: 800, freeShipping: true, onSale: false },
      { store: 'Lazada', price: 209, rating: 4.3, reviews: 400, freeShipping: false, onSale: false },
      { store: 'Qoo10', price: 195, rating: 4.4, reviews: 220, freeShipping: true, onSale: true }
    ]
  },
  {
    name: 'Bose QuietComfort Ultra',
    aliases: ['bose', 'quietcomfort'],
    related: ['Sony WH-1000XM5', 'Apple AirPods Pro 2'],
    history: [499, 489, 479, 505, 519, 499, 489, 479, 495, 509, 519, 529, 515, 509],
    listings: [
      { store: 'Courts', price: 549, rating: 4.4, reviews: 310, freeShipping: true, onSale: false },
      { store: 'Best Denki', price: 559, rating: 4.5, reviews: 140, freeShipping: true, onSale: false },
      { store: 'Amazon.sg', price: 569, rating: 4.3, reviews: 620, freeShipping: true, onSale: false },
      { store: 'Shopee', price: 579, rating: 4.1, reviews: 90, freeShipping: false, onSale: true },
      { store: 'Challenger', price: 599, rating: 4.2, reviews: 40, freeShipping: false, onSale: false }
    ]
  }
]

export const trending = [
  { query: 'Sony WH-1000XM5', count: 186 },
  { query: 'Apple AirPods Pro 2', count: 142 },
  { query: 'Nintendo Switch OLED', count: 97 },
  { query: 'Kindle Paperwhite', count: 64 },
  { query: 'Bose QuietComfort Ultra', count: 41 },
  { query: 'Dyson Supersonic', count: 28 },
  { query: 'Hydro Flask 32 oz', count: 19 }
]

export function sgd(n) {
  return 'S$' + Number(n).toFixed(2)
}

export function hashString(text) {
  let h = 216
  const s = String(text)
  for (let i = 0; i < s.length; i++) {
    h = (h * 33 + s.charCodeAt(i)) % 1000003
  }
  return h
}

export function findProduct(query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) {
    return null
  }
  for (let i = 0; i < catalog.length; i++) {
    const product = catalog[i]
    if (product.name.toLowerCase() === q) {
      return product
    }
    for (let j = 0; j < product.aliases.length; j++) {
      if (q.indexOf(product.aliases[j]) !== -1) {
        return product
      }
    }
  }
  return null
}

function generated(name) {
  const h = hashString(name.toLowerCase())
  const base = 40 + (h % 460)
  const listings = []
  for (let i = 0; i < 6; i++) {
    const price = base + ((h + i * 17) % 80)
    listings.push({
      store: stores[(h + i) % stores.length],
      price: price,
      rating: Math.round((38 + ((h + i * 3) % 10)) ) / 10,
      reviews: 40 + ((h + i * 97) % 2400),
      freeShipping: (h + i) % 2 === 0,
      onSale: (h + i) % 3 === 0
    })
  }
  const history = []
  for (let d = 0; d < 14; d++) {
    history.push(base + ((h + d * 11) % 70))
  }
  const related = []
  for (let r = 0; r < catalog.length && related.length < 2; r++) {
    if (catalog[r].name.toLowerCase() !== name.toLowerCase()) {
      related.push(catalog[r].name)
    }
  }
  return {
    name: name,
    listings: listings,
    history: history,
    related: related,
    known: false
  }
}

export function buildResult(query) {
  const name = String(query || '').trim()
  const known = findProduct(name)
  if (known) {
    return {
      name: known.name,
      listings: known.listings.slice(),
      history: known.history.slice(),
      related: known.related.slice(),
      known: true
    }
  }
  return generated(name)
}

export function cheapestPrice(query) {
  const result = buildResult(query)
  let low = result.listings[0].price
  for (let i = 1; i < result.listings.length; i++) {
    if (result.listings[i].price < low) {
      low = result.listings[i].price
    }
  }
  return low
}

export function verdictFor(result) {
  let cheapest = result.listings[0].price
  let ratingSum = 0
  let reviewSum = 0
  for (let i = 0; i < result.listings.length; i++) {
    const row = result.listings[i]
    if (row.price < cheapest) {
      cheapest = row.price
    }
    ratingSum += row.rating
    reviewSum += row.reviews
  }
  let low = result.history[0]
  let sum = 0
  for (let d = 0; d < result.history.length; d++) {
    sum += result.history[d]
    if (result.history[d] < low) {
      low = result.history[d]
    }
  }
  const avg = sum / result.history.length
  const rating = ratingSum / result.listings.length
  let label = 'Maybe'
  let action = 'Wait'
  let why = 'The price is above the recent average. A lower price showed up in the last 14 days.'
  if (cheapest <= low * 1.03 && rating >= 4.3) {
    label = 'Worth It'
    action = 'Buy now'
    why = 'The cheapest price is at the low end of the last 14 days, and seller ratings are high.'
  } else if (cheapest > avg * 1.08 || rating < 3.9) {
    label = 'Not Worth It'
    action = 'Wait'
    why = 'The cheapest price is above the recent average, or the ratings are weak.'
  } else if (cheapest <= avg) {
    label = 'Maybe'
    action = 'Buy now'
    why = 'The price is near the recent average. Ratings are acceptable, but this is not the low.'
  }
  return {
    label: label,
    action: action,
    why: why,
    cheapest: cheapest,
    low: low,
    avg: avg,
    rating: rating,
    reviewSum: reviewSum
  }
}

export function nameFromFile(filename) {
  const stem = String(filename || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  const known = findProduct(stem)
  if (known) {
    return known.name
  }
  if (!stem) {
    return 'Sony WH-1000XM5'
  }
  return stem
}

export function dayLabel(indexFromEnd) {
  const date = new Date()
  date.setDate(date.getDate() - indexFromEnd)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return date.getDate() + ' ' + months[date.getMonth()]
}
