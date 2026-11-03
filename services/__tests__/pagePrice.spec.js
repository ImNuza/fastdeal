// pagePrice.spec.js
// Used by vitest to test pagePrice in services/targetPriceEmail.js: the price the alert check uses
// from a product page, the same one the Wishlist page shows.

import { describe, it, expect } from 'vitest'
import { pagePrice } from '../targetPriceEmail.js'

describe('TestSuite1: pagePrice', () => {
  it('Test1: the saved listing ("Your pick") wins, even when another store is cheaper', () => {
    const pick = { store: 'Lazada', price: 1021.52 }
    const product = { pick, stores: [{ store: 'Shopee', price: 899 }, pick] }
    expect(pagePrice(product)).toEqual(pick)
  })

  it('Test2: without a pick, the cheapest store with a price', () => {
    const product = {
      pick: null,
      stores: [{ store: 'A', price: 50 }, { store: 'B', price: 0 }, { store: 'C', price: 46.2 }]
    }
    expect(pagePrice(product).store).toBe('C')
  })

  it('Test3: a pick with no price is skipped', () => {
    const product = { pick: { store: 'A', price: 0 }, stores: [{ store: 'B', price: 30 }] }
    expect(pagePrice(product).store).toBe('B')
  })

  it('Test4: no store price gives null', () => {
    expect(pagePrice({ pick: null, stores: [] })).toBe(null)
    expect(pagePrice({ pick: null })).toBe(null)
  })
})
