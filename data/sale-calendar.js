// Yearly sale days and the stores that usually join them.
// Not guaranteed: each store decides every year. Add a store only with a source.
//
// Sources (checked 16 Oct 2026):
// - Shopee and Lazada run a double-day sale almost every month. 9.9, 10.10,
//   11.11 and 12.12 are the big ones, and 11.11 is usually the deepest.
//   https://www.shopback.sg/blog/finance/singapore-2026-sale-calendar
//   https://www.shopback.sg/blog/finance/sg-9-9-vs-10-10-vs-11-11-shopping-timing-2026

// Every double day. big = one of the yearly mega sales.
export const SALE_EVENTS = [
  { id: '1.1', name: '1.1 sale', month: 1, day: 1, big: false },
  { id: '2.2', name: '2.2 sale', month: 2, day: 2, big: false },
  { id: '3.3', name: '3.3 sale', month: 3, day: 3, big: false },
  { id: '4.4', name: '4.4 sale', month: 4, day: 4, big: false },
  { id: '5.5', name: '5.5 sale', month: 5, day: 5, big: false },
  { id: '6.6', name: '6.6 sale', month: 6, day: 6, big: false },
  { id: '7.7', name: '7.7 sale', month: 7, day: 7, big: false },
  { id: '8.8', name: '8.8 sale', month: 8, day: 8, big: false },
  { id: '9.9', name: '9.9 sale', month: 9, day: 9, big: true },
  { id: '10.10', name: '10.10 sale', month: 10, day: 10, big: true },
  { id: '11.11', name: '11.11 sale', month: 11, day: 11, big: true },
  { id: '12.12', name: '12.12 sale', month: 12, day: 12, big: true }
]

const ALL_DOUBLE_DAYS = SALE_EVENTS.map(function (event) {
  return event.id
})

// match is compared with the lowercase store name from SerpApi, for example "Lazada Singapore".
export const STORE_SALES = [
  { match: 'shopee', label: 'Shopee', events: ALL_DOUBLE_DAYS },
  { match: 'lazada', label: 'Lazada', events: ALL_DOUBLE_DAYS }
]
