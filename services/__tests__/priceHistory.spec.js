// priceHistory.spec.js
// Used by vitest to test the pure functions in services/priceHistory.js

import { describe, it, expect } from 'vitest'
import { sgDay, storePrices } from '../priceHistory.js'

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
