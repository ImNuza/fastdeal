// target-price.spec.js
// Used by vitest to test cleanTarget in models/target-price-model.js: which AI answers become a target.

import { describe, it, expect } from 'vitest'
import { cleanTarget } from '../target-price-model.js'

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
