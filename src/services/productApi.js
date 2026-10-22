// Loads one product with every store and the Deal check.
// q is the search the product came from. The server needs it after a reload.
export async function fetchProduct(productId, q) {
  const url = '/api/product/' + encodeURIComponent(productId) + '?q=' + encodeURIComponent(q || '')
  const res = await fetch(url)
  const data = await res.json().catch(function () {
    return {}
  })
  if (!res.ok) {
    throw new Error(data.error || 'Could not load this product.')
  }
  return data
}
