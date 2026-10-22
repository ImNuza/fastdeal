// The search term in title case, for the compare page heading.
// The wishlist does not use it: it saves each product under the product's own title.
export function itemName(searchTerm) {
  return String(searchTerm || '').replace(/\b\w/g, function (c) { return c.toUpperCase() })
}
