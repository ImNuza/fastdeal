// Typical price for one product: the middle total of the stores that sell it today.
// The AI "Worth it?" verdict and its rule fallback compare the cheapest total with it.
// Plain functions with no database calls, so they are easy to test.

// With fewer stores than this, a typical price means little
const MIN_STORES = 3

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
