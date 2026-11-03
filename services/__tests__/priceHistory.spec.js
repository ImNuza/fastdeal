// priceHistory.spec.js
// Used by vitest to test the pure functions in services/priceHistory.js

import { describe, it, expect } from 'vitest'
import { sgDay, storePrices, seededPrices, summarizeHistory, lastDays, MIN_HISTORY_DAYS } from '../priceHistory.js'

describe('TestSuite1: sgDay', () => {
  it('Test1: gives the Singapore date, which is 8 hours ahead of UTC', () => {
    expect(sgDay(Date.UTC(2026, 9, 31, 4, 0))).toBe('2026-10-31')
    expect(sgDay(Date.UTC(1970, 0, 1, 0, 0))).toBe('1970-01-01')
  })

  it('Test2: changes day at 16:00 UTC, which is midnight in Singapore', () => {
    expect(sgDay(Date.UTC(2026, 9, 31, 15, 59, 59))).toBe('2026-10-31')
    expect(sgDay(Date.UTC(2026, 9, 31, 16, 0, 0))).toBe('2026-11-01')
  })

  it('Test3: rolls over the month and the year at the midnight edge', () => {
    expect(sgDay(Date.UTC(2026, 11, 31, 15, 59))).toBe('2026-12-31')
    expect(sgDay(Date.UTC(2026, 11, 31, 16, 0))).toBe('2027-01-01')
  })
})

describe('TestSuite2: storePrices', () => {
  it('Test1: returns an empty list when there are no usable prices', () => {
    expect(storePrices([])).toEqual([])
    expect(storePrices([{ store: 'A', price: 0 }, { store: 'B', price: -5 }, { store: 'C', price: 'abc' }])).toEqual([])
  })

  it('Test2: lists each store with its price, cheapest first', () => {
    const listings = [
      { store: 'B', price: 120 },
      { store: 'A', price: 100 },
      { store: 'C', price: 110 }
    ]
    expect(storePrices(listings)).toEqual([
      { store: 'A', price: 100 },
      { store: 'C', price: 110 },
      { store: 'B', price: 120 }
    ])
  })

  it('Test3: keeps only the cheapest price of a store listed more than once', () => {
    const listings = [
      { store: 'A', price: 120 },
      { store: 'A', price: 100 },
      { store: 'B', price: 110 }
    ]
    expect(storePrices(listings)).toEqual([
      { store: 'A', price: 100 },
      { store: 'B', price: 110 }
    ])
  })

  it('Test4: drops a price under half the median, such as an accessory (edge at exactly half)', () => {
    const base = [{ store: 'A', price: 100 }, { store: 'B', price: 100 }, { store: 'C', price: 100 }]
    const atHalf = storePrices(base.concat([{ store: 'D', price: 50 }]))
    const underHalf = storePrices(base.concat([{ store: 'D', price: 49.99 }]))
    expect(atHalf.map(function (r) { return r.store })).toContain('D')
    expect(underHalf.map(function (r) { return r.store })).not.toContain('D')
  })

  it('Test5: drops a price over double the median, such as a bundle (edge at exactly double)', () => {
    const base = [{ store: 'A', price: 100 }, { store: 'B', price: 100 }, { store: 'C', price: 100 }]
    const atDouble = storePrices(base.concat([{ store: 'D', price: 200 }]))
    const overDouble = storePrices(base.concat([{ store: 'D', price: 200.01 }]))
    expect(atDouble.map(function (r) { return r.store })).toContain('D')
    expect(overDouble.map(function (r) { return r.store })).not.toContain('D')
  })

  it('Test6: works out the median of an even count from the two middle prices', () => {
    // sorted 20, 100, 110, 120 -> median 105 -> range 52.5 to 210, so 20 is dropped
    const listings = [
      { store: 'A', price: 100 },
      { store: 'B', price: 120 },
      { store: 'C', price: 110 },
      { store: 'D', price: 20 }
    ]
    expect(storePrices(listings).map(function (r) { return r.store })).toEqual(['A', 'C', 'B'])
  })

  it('Test7: skips rows with no store name and reads prices given as text', () => {
    const listings = [
      { store: '', price: 100 },
      { price: 100 },
      { store: 'A', price: '99.5' },
      { store: 'B', price: '100' }
    ]
    expect(storePrices(listings)).toEqual([
      { store: 'A', price: 99.5 },
      { store: 'B', price: 100 }
    ])
  })
})

// Daily rows for summarizeHistory: one per day from 1 Oct, with these prices
function days(prices, source) {
  return prices.map(function (price, i) {
    return { day: '2026-10-' + String(i + 1).padStart(2, '0'), price: price, source: source || 'seed' }
  })
}

describe('TestSuite3: seededPrices', () => {
  it('Test1: gives 30 days, oldest first, ending at the real captured price', () => {
    const rows = seededPrices(100, 0)
    expect(rows).toHaveLength(30)
    expect(rows[0].daysAgo).toBe(29)
    expect(rows[29]).toEqual({ daysAgo: 0, price: 100 })
  })

  it('Test2: gives the same prices every time, and a sale dip about 10 days ago', () => {
    expect(seededPrices(100, 2)).toEqual(seededPrices(100, 2))
    const dip = seededPrices(100, 0).find(function (row) { return row.daysAgo === 10 })
    expect(dip.price).toBeLessThan(95)
  })
})

describe('TestSuite4: summarizeHistory', () => {
  it('Test1: has no history with fewer than ' + MIN_HISTORY_DAYS + ' days', () => {
    expect(summarizeHistory([])).toBe(null)
    expect(summarizeHistory(days([10, 11, 12]))).toBe(null)
  })

  it('Test2: finds the low, high, average and the day of the low', () => {
    const prices = [20, 19, 18, 17, 16, 15, 14, 15, 16, 17, 18, 19, 20, 21]
    const history = summarizeHistory(days(prices))
    expect(history.days).toBe(14)
    expect(history.low).toBe(14)
    expect(history.lowDay).toBe('2026-10-07')
    expect(history.high).toBe(21)
    expect(history.average).toBe(17.5)
    expect(history.last).toBe(21)
  })

  it('Test3: keeps the lowest price of each day when several stores have one', () => {
    const rows = days([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10])
    rows.push({ day: '2026-10-03', price: 8, source: 'product' })
    const history = summarizeHistory(rows)
    expect(history.low).toBe(8)
    expect(history.days).toBe(14)
  })

  it('Test4: gives the 7-day change in percent, and marks seeded rows', () => {
    const history = summarizeHistory(days([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11]))
    expect(history.weekChange).toBe(10)
    expect(history.seeded).toBe(true)
    expect(summarizeHistory(days([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10], 'search')).seeded).toBe(false)
  })
})

describe('TestSuite5: lastDays', () => {
  it('Test1: keeps the 30 days back from the newest row, not from today', () => {
    const rows = [
      { day: '2026-09-01', price: 5 },
      { day: '2026-10-05', price: 6 },
      { day: '2026-10-06', price: 7 },
      { day: '2026-11-03', price: 8 }
    ]
    // 30 days ending 3 Nov start on 5 Oct, so 1 Sep is left out
    expect(lastDays(rows).map(function (row) { return row.day })).toEqual(['2026-10-05', '2026-10-06', '2026-11-03'])
  })

  it('Test2: gives no rows for no rows', () => {
    expect(lastDays([])).toEqual([])
  })
})
