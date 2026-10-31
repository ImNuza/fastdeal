// Product page data: every store for one product, buyer reviews and the Deal check.
// Flow: ProductView -> GET /api/product/:productId?q= -> getProduct(productId, q)
//   1. productCache has it and the prices are under 24 hours old: use it, no SerpApi credit.
//   2. productCache has it but the prices are older: refresh with the saved token (1 credit).
//   3. Not saved, or the token no longer works: find the listing in the saved search
//      (search again if that expired), then call SerpApi Google Immersive Product (1 credit).
// The row stays 30 days, so a product link keeps working after the search cache expires.
import { serpGet } from './serpapiKeys.js'
import ProductCache from '../models/product-cache-model.js'
import SearchCache from '../models/search-cache-model.js'
import { toProductKey } from '../models/product-key.js'
import { search } from '../models/shoppingapimodel.js'
import { dealCheck, typicalPrice } from './dealCheck.js'
import { recordPrices } from './priceHistory.js'

const HOUR = 3600000
// Store prices older than this are loaded again
const PRICES_HOURS = 24
// After a failed refresh, try again after this many hours (not on every view)
const RETRY_HOURS = 1
// How long a product row (and its link) is kept
const KEEP_DAYS = 30
const MAX_REVIEWS = 3
// Some products list 30 features. The page shows the first ones only.
const MAX_FEATURES = 8

// The clicked listing and its saved search, or null. Matches the product id first,
// then the product title, because Google can give a product a new id in a new search.
async function findListing(productKey, productId, title) {
  const saved = await SearchCache.findOne({ queryKey: productKey, expiresAt: { $gt: new Date() } }).lean()
  if (!saved) {
    return null
  }
  const titleKey = title ? toProductKey(title) : ''
  const listing = saved.listings.find(function (row) {
    return row.productId === productId
  }) || saved.listings.find(function (row) {
    return titleKey && toProductKey(row.name) === titleKey
  })
  return listing ? { listing: listing, searchTerm: saved.searchTerm || '' } : null
}

// Google Immersive Product for one page token. Every store (more_stores), not only 3 to 5.
// Returns product_results, or null when SerpApi refuses the token.
async function fetchImmersive(token) {
  try {
    const json = await serpGet({
      engine: 'google_immersive_product',
      page_token: token,
      more_stores: true,
      hl: 'en',
      gl: 'sg'
    })
    return json.product_results || null
  } catch (error) {
    return null
  }
}

// Google gives some stores a redirect link with no domain ("/goto?url=..."). In the browser it would
// open on FastDeal and show 404, so it gets Google's domain. Full links stay as they are.
export function storeUrl(link) {
  const text = String(link || '')
  return text.startsWith('/') ? 'https://www.google.com' + text : text
}

// One SerpApi store row in the shape the product page uses.
function toStore(row) {
  const price = Number(row.extracted_price) || 0
  return {
    store: row.name || 'Unknown',
    // The store's small icon from Google Shopping. Older cached rows have none.
    logo: row.logo || '',
    price: price,
    oldPrice: Number(row.extracted_original_price) || null,
    shipping: row.shipping || '',
    total: Number(row.extracted_total) || price,
    link: row.link || '',
    tag: row.tag || '',
    // First stock or delivery note, for example "In stock online"
    note: (row.details_and_offers || [])[0] || ''
  }
}

// One row per store name: its cheapest total, plus how many other offers it has
// and the cheapest of those. Shopee often comes back 3 times from 3 sellers.
function onePerStore(rows) {
  const byStore = {}
  for (const row of rows) {
    const list = byStore[row.store] || []
    list.push(row)
    byStore[row.store] = list
  }
  return Object.values(byStore).map(function (list) {
    list.sort(function (a, b) {
      return a.total - b.total
    })
    return Object.assign({}, list[0], {
      moreOffers: list.length - 1,
      moreFrom: list.length > 1 ? list[1].total : null
    })
  })
}

// Up to MAX_REVIEWS reviews, no repeats. source says which site (often another country).
// Repeats are matched on their first 8 words of 3 or more letters, since a copy
// often differs in a character or two ("I found" and ": found").
function toReviews(list) {
  const seen = new Set()
  const out = []
  for (const row of list || []) {
    const text = String(row.text || '').trim()
    const key = (text.toLowerCase().match(/[a-z]{3,}/g) || []).slice(0, 8).join(' ')
    if (!text || seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push({
      text: text,
      rating: Number(row.rating) || null,
      date: row.date || '',
      source: row.source || '',
      user: row.user_name || ''
    })
    if (out.length === MAX_REVIEWS) {
      break
    }
  }
  return out
}

// Star counts, 5 stars first.
function toRatings(list) {
  return (list || [])
    .map(function (row) {
      return { stars: Number(row.stars) || 0, amount: Number(row.amount) || 0 }
    })
    .sort(function (a, b) {
      return b.stars - a.stars
    })
}

// Loads the product from SerpApi and saves it in productCache. cached is the old row or null.
async function loadFromSerpApi(productId, productKey, q, cached) {
  let result = null
  let listing = null
  let searchTerm = cached ? cached.searchTerm : ''
  let token = cached ? cached.immersiveToken : ''

  // Refresh with the saved token: no new search needed.
  if (token) {
    result = await fetchImmersive(token)
  }

  if (!result) {
    const title = cached ? cached.title : ''
    let found = await findListing(productKey, productId, title)
    if (!found && q) {
      // The saved search expired: search again (1 credit) and look once more.
      await search(q)
      found = await findListing(productKey, productId, title)
    }
    if (!found) {
      throw new Error('This listing is no longer in the results. Search for it again.')
    }
    listing = found.listing
    searchTerm = found.searchTerm
    token = listing.immersiveToken || ''
    if (token) {
      result = await fetchImmersive(token)
    }
  }

  const info = result || {}
  let stores = onePerStore((info.stores || []).map(toStore).filter(function (row) {
    return row.price > 0
  }))
  // false when SerpApi gave no stores (quota used up, bad token): the prices below are old
  const live = stores.length > 0
  // No store list from SerpApi: keep the old stores, else show the clicked listing alone.
  if (!stores.length && cached) {
    stores = cached.stores
  }
  if (!stores.length && listing) {
    stores = [{
      store: listing.store,
      price: listing.price,
      oldPrice: listing.oldPrice || null,
      shipping: listing.freeShipping ? 'Free' : '',
      total: listing.price,
      link: listing.link,
      tag: '',
      note: '',
      moreOffers: 0,
      moreFrom: null
    }]
  }
  if (!stores.length) {
    throw new Error('No store sells this product right now. Search for it again.')
  }

  const old = cached || {}
  const from = listing || {}
  const about = info.about_the_product || {}
  const now = new Date()
  // Old prices keep their age, so they are not shown as fresh. Retry in RETRY_HOURS.
  const storesFetchedAt = live || !cached ? now : new Date(now.getTime() - (PRICES_HOURS - RETRY_HOURS) * HOUR)
  const row = {
    productId: productId,
    productKey: productKey || old.productKey,
    q: q || old.q || '',
    searchTerm: searchTerm || old.searchTerm || '',
    immersiveToken: token,
    title: info.title || old.title || from.name || '',
    brand: info.brand || old.brand || null,
    image: (info.thumbnails || [])[0] || old.image || from.image || null,
    rating: Number(info.rating) || old.rating || from.rating || null,
    reviews: Number(info.reviews) || old.reviews || from.reviews || null,
    description: about.description || old.description || '',
    features: (about.features || old.features || []).slice(0, MAX_FEATURES),
    ratings: info.ratings ? toRatings(info.ratings) : old.ratings || [],
    userReviews: info.user_reviews ? toReviews(info.user_reviews) : old.userReviews || [],
    stores: stores,
    storesFetchedAt: storesFetchedAt,
    expiresAt: new Date(now.getTime() + KEEP_DAYS * 24 * HOUR)
  }
  await ProductCache.findOneAndUpdate({ productId: productId }, row, { upsert: true })

  // priceDays under this product's own title, not the search words. Only for new prices.
  if (live) {
    await recordPrices(toProductKey(row.title), stores.map(function (store) {
      return Object.assign({ productId: productId }, store)
    }), 'product')
  }
  return row
}

export async function getProduct(productId, q) {
  let product = await ProductCache.findOne({ productId: productId, expiresAt: { $gt: new Date() } }).lean()
  const productKey = toProductKey(q || (product && product.q) || '')
  const fresh = product && product.storesFetchedAt &&
    Date.now() - new Date(product.storesFetchedAt).getTime() < PRICES_HOURS * HOUR
  if (!fresh) {
    product = await loadFromSerpApi(productId, productKey, q, product)
  }

  const typical = typicalPrice(product.stores)
  const now = Date.now()
  const stores = product.stores
    .map(function (store) {
      // storeUrl here also fixes rows saved in productCache before this change.
      return Object.assign({}, store, { link: storeUrl(store.link), deal: dealCheck(store, product.stores, typical, now) })
    })
    .sort(function (a, b) {
      return a.total - b.total
    })

  return {
    productId: product.productId,
    q: product.q,
    searchTerm: product.searchTerm,
    title: product.title,
    brand: product.brand,
    image: product.image,
    rating: product.rating,
    reviews: product.reviews,
    description: product.description,
    features: product.features,
    ratings: product.ratings,
    userReviews: product.userReviews,
    typicalPrice: typical,
    stores: stores,
    fetchedAt: product.storesFetchedAt
  }
}
