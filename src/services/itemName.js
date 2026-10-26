// A search term in title case, for showing it as a product name (compare heading, trending,
// recent searches). The wishlist does not use it: it saves each product under the product's own title.
// Each word is handled on its own:
// - all lowercase ("sony", "headphones") gets a capital first letter: "Sony", "Headphones"
// - with digits ("wh-1000xm5", "s25") is a model number, so it goes all caps: "WH-1000XM5", "S25"
// - already mixed case ("iPhone", "PlayStation") is left as typed
export function itemName(searchTerm) {
  return String(searchTerm || '').trim().split(/\s+/).map(function (word) {
    if (/\d/.test(word)) {
      return word.toUpperCase()
    }
    if (word === word.toLowerCase()) {
      return word.charAt(0).toUpperCase() + word.slice(1)
    }
    return word
  }).join(' ')
}
