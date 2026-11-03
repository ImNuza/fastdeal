// target-price.spec.js
// Used by vitest to test cleanTarget in models/target-price-model.js: which AI answers become a target.

import { describe, it, expect } from 'vitest'
import { cleanTarget, summarizeListings } from '../target-price-model.js'

const history = { low: 40, high: 60, average: 50 }

describe('TestSuite1: cleanTarget', () => {
  it('Test1: keeps a price below the saved price, rounded to cents', () => {
    expect(cleanTarget(44.456, 55, history)).toBe(44.46)
  })

  it('Test2: drops a price at or above the saved price', () => {
    expect(cleanTarget(55, 55, history)).toBe(null)
    expect(cleanTarget(70, 55, history)).toBe(null)
  })

  it('Test3: drops a price far under the 30-day low', () => {
    expect(cleanTarget(30, 55, history)).toBe(null)
    expect(cleanTarget(34, 55, history)).toBe(34)
  })

  it('Test4: drops answers that are not a positive number', () => {
    expect(cleanTarget('abc', 55, history)).toBe(null)
    expect(cleanTarget(0, 55, history)).toBe(null)
    expect(cleanTarget(-5, 55, history)).toBe(null)
    expect(cleanTarget(undefined, 55, history)).toBe(null)
  })
})

describe('TestSuite2: cleanTarget with listings', () => {
  const listings = { count: 4, low: 40, high: 70, typical: 52 }

  it('Test1: works from the listings alone, with no price history', () => {
    expect(cleanTarget(45, 55, null, listings)).toBe(45)
  })

  it('Test2: drops a price far under the cheapest listing', () => {
    expect(cleanTarget(30, 55, null, listings)).toBe(null)
  })
})

describe('TestSuite3: summarizeListings', () => {
  it('Test1: gives the cheapest, highest and middle total', () => {
    const rows = [
      { store: 'B', total: 60 },
      { store: 'A', total: 40 },
      { store: 'C', total: 50 }
    ]
    expect(summarizeListings(rows)).toEqual({ count: 3, low: 40, lowStore: 'A', high: 60, typical: 50 })
  })

  it('Test2: averages the two middle totals for an even count', () => {
    expect(summarizeListings([{ total: 40 }, { total: 50 }, { total: 60 }, { total: 70 }]).typical).toBe(55)
  })

  it('Test3: gives null with no priced rows', () => {
    expect(summarizeListings([])).toBe(null)
    expect(summarizeListings([{ store: 'A', total: 0 }])).toBe(null)
  })
})
