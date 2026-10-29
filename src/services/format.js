export function sgd(n) {
  return 'S$' + Number(n).toFixed(2)
}

// Each store links to its own search for the product name.
const storeSearch = {
  'Shopee': 'https://shopee.sg/search?keyword=',
  'Lazada': 'https://www.lazada.sg/catalog/?q=',
  'Amazon.sg': 'https://www.amazon.sg/s?k=',
  'Courts': 'https://www.courts.com.sg/catalogsearch/result/?q=',
  'Best Denki': 'https://www.bestdenki.com.sg/catalogsearch/result/?q=',
  'Challenger': 'https://www.challenger.sg/search?q=',
  'Qoo10': 'https://www.qoo10.sg/s/?keyword=',
  'iShopChangi': 'https://www.ishopchangi.com/en/search?q='
}

export function storeLink(store, name) {
  const base = storeSearch[store]
  return base ? base + encodeURIComponent(name) : ''
}

// "2026-10-27" as "27 Oct"
export function dayText(day) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const parts = String(day).split('-')
  return Number(parts[2]) + ' ' + months[Number(parts[1]) - 1]
}
