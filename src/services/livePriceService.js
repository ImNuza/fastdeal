
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

export async function fetchCheapestLiveListing(productName) {
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
