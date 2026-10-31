import { fetchProduct } from './productApi.js'

const excludedWords = /\b(case only|phone case|cover only|ear pads?|earpads|replacement|spare parts?|screen protector|charging cable|cable only|accessory)\b/i

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isComparable(productName, listing) {
  const requested = normalise(productName)
  const title = normalise(listing.name)

  const price = Number(listing.price)

  if (!Number.isFinite(price) || price <= 0) {
    return false
  }

  if (excludedWords.test(listing.name)) {
    return false
  }

  const words = requested.split(' ').filter(Boolean)

  if (!words.length) {
    return false
  }

  // Require every word from the requested product name.
  return words.every(word =>
    title.split(' ').includes(word)
  )
}

// A product saved from its product page has a Google Shopping productId. Its live price is the
// cheapest store on that same product (GET /api/product/:id, cached on the server for 24 hours),
// so a long product title never needs to match a new search word for word.
async function cheapestStoreOf(saved) {
  const product = await fetchProduct(saved.productId, saved.q || saved.name)
  const stores = (product.stores || []).filter(store => Number(store.price) > 0)

  if (!stores.length) {
    throw new Error('No store price found for this product')
  }

  const cheapest = stores.reduce((lowest, store) =>
    Number(store.price) < Number(lowest.price) ? store : lowest
  )

  return {
    name: product.title,
    store: cheapest.store,
    link: cheapest.link,
    price: Number(cheapest.price),
    fetchedAt: product.fetchedAt
  }
}

// saved: the wishlist item, when there is one. With a productId it uses the product's own stores.
// Without one (older items), or when that fails, it searches by name as before.
export async function fetchCheapestLiveListing(productName, saved) {
  if (saved && saved.productId) {
    try {
      return await cheapestStoreOf(saved)
    } catch (error) {
      // Fall back to the search below.
    }
  }

  const response = await fetch(
    '/api/search?q=' + encodeURIComponent(productName)
  )

  if (!response.ok) {
    throw new Error('Failed to retrieve live product prices')
  }

  const data = await response.json()

  if (!Array.isArray(data.listings)) {
    throw new Error('Invalid API response')
  }

  const validListings = data.listings.filter(item =>
    isComparable(productName, item)
  )

  if (validListings.length === 0) {
    throw new Error('No comparable product listings found')
  }

  const cheapest = validListings.reduce((lowest, item) =>
    Number(item.price) < Number(lowest.price) ? item : lowest
  )

  return {
    ...cheapest,
    price: Number(cheapest.price),
    fetchedAt: data.fetchedAt
  }
}
