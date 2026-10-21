// The one name a product is saved under in the wishlist: the search term in title case.
// The compare page and the product page both use it, so one search gives one wishlist row,
// and the wishlist's live price check searches the short name (usually a cached search).
// Title case, since SerpAPI's per-item titles are each a different variant (e.g. "...Pro", "...Pro XL").
export function itemName(searchTerm) {
  return String(searchTerm || '').replace(/\b\w/g, function (c) { return c.toUpperCase() })
}
