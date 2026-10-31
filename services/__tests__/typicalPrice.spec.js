// typicalPrice.spec.js
// Used by vitest to test services/typicalPrice.js

import { describe, it, expect } from 'vitest'
import { typicalPrice } from '../typicalPrice.js'

// A store row as typicalPrice reads it
function row(store, price, total) {
  return { store: store, price: price, total: total }
}

describe('TestSuite1: typicalPrice', () => {
  it('Test1: returns null with fewer than 3 stores', () => {
    expect(typicalPrice([])).toBe(null)
    expect(typicalPrice([row('A', 10, 10)])).toBe(null)
    expect(typicalPrice([row('A', 10, 10), row('B', 20, 20)])).toBe(null)
  })

  it('Test2: gives the middle total when the store count is odd', () => {
    expect(typicalPrice([row('A', 10, 10), row('B', 30, 30), row('C', 20, 20)])).toBe(20)
    expect(typicalPrice([row('A', 1, 1), row('B', 9, 9), row('C', 5, 5), row('D', 7, 7), row('E', 100, 100)])).toBe(7)
  })

  it('Test3: gives the average of the two middle totals when the store count is even', () => {
    expect(typicalPrice([row('A', 10, 10), row('B', 20, 20), row('C', 30, 30), row('D', 40, 40)])).toBe(25)
  })

  it('Test4: uses the total (price plus shipping), not the price', () => {
    const stores = [row('A', 10, 40), row('B', 20, 50), row('C', 30, 60)]
    expect(typicalPrice(stores)).toBe(50)
  })
})
