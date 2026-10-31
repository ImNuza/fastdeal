// Loads one product with every store and the Deal check.
// q is the search the product came from. The server needs it after a reload.
export async function fetchProduct(productId, q) {
  const url = '/api/product/' + encodeURIComponent(productId) + '?q=' + encodeURIComponent(q || '')
  const res = await fetch(url)
  const data = await res.json().catch(function () {
    return {}
  })
  if (!res.ok) {
    const error = new Error(data.error || 'Could not load this product.')
    error.status = res.status
    throw error
  }
  return data
}

//search with feature
export async function fetchSearchedWith(q,sid) {
  const res = await fetch('/api/searched-with?key=' + encodeURIComponent(q || '') + '&sid=' + encodeURIComponent(sid || ''))
  return res.json()
}
// Lowest price on each of the last 14 days for a searched product: [{ day: 'YYYY-MM-DD', price }].
export async function fetchPriceHistory(key) {
  const res = await fetch('/api/price-history?key=' + encodeURIComponent(key || ''))
  return res.json()
}

// AI "Worth It" verdict for one product. The server reads the product's live stores, its tracked
// price history and the next big sale. The answer also has inputs, summary and prompt: what the AI
// read, for the "How this verdict was made" page. The backend always returns a verdict object
// (graceful fallback on any error), so we just return the JSON.
export async function fetchWorthIt(productId, q) {
  const url = '/api/worth-it?productId=' + encodeURIComponent(productId || '') +
    '&q=' + encodeURIComponent(q || '')
  const res = await fetch(url)
  return res.json().catch(function () {
    return {
      decision: 'unknown',
      headline: 'No verdict available',
      reason: 'We could not get an AI verdict right now. Use the deal check below.',
      source: 'fallback'
    }
  })
}
