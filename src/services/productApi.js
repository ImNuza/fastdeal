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
