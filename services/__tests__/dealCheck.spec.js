// dealCheck.spec.js
// Used by vitest to test the deal check rules in services/dealCheck.js

import { describe, it, expect } from 'vitest'
import { typicalPrice, priceLabel, wasPriceLabel, saleSoon, dealCheck } from '../dealCheck.js'

// A store row as the deal check reads it
function row(store, price, total, oldPrice) {
  return { store: store, price: price, total: total, oldPrice: oldPrice || null }
}

// Singapore time is UTC+8, so 04:00 UTC is noon in Singapore
const OCT_31 = Date.UTC(2026, 9, 31, 4, 0)
const NOV_10 = Date.UTC(2026, 10, 10, 4, 0)
const NOV_11 = Date.UTC(2026, 10, 11, 4, 0)

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

describe('TestSuite2: priceLabel', () => {
  it('Test1: says too few stores when there is no typical price', () => {
    const one = priceLabel(row('A', 10, 10), null, 1)
    const two = priceLabel(row('A', 10, 10), null, 2)
    expect(one.label).toBe('Too few stores to compare')
    expect(one.tone).toBe('muted')
    expect(one.detail).toBe('Only 1 store sells it today.')
    expect(two.detail).toBe('Only 2 stores sell it today.')
  })

  it('Test2: labels a total under half the typical price as much cheaper, with a warning', () => {
    const label = priceLabel(row('A', 49, 49), 100, 5)
    expect(label.label).toBe('Much cheaper than other stores')
    expect(label.tone).toBe('warn')
    expect(label.detail).toContain('51% below the typical S$100.00.')
  })

  it('Test3: labels exactly half the typical price as a good price (edge of much cheaper)', () => {
    const label = priceLabel(row('A', 50, 50), 100, 5)
    expect(label.label).toBe('Good price')
    expect(label.tone).toBe('good')
    expect(label.detail).toBe('50% below the typical S$100.00.')
  })

  it('Test4: labels 89% of the typical price as good and 90% as typical (edge of good)', () => {
    expect(priceLabel(row('A', 89, 89), 100, 5).label).toBe('Good price')
    const edge = priceLabel(row('A', 90, 90), 100, 5)
    expect(edge.label).toBe('Typical price')
    expect(edge.tone).toBe('muted')
    expect(edge.detail).toBe('Close to the typical S$100.00.')
  })

  it('Test5: labels the typical price itself and 115% as typical, 116% as above typical', () => {
    expect(priceLabel(row('A', 100, 100), 100, 5).label).toBe('Typical price')
    expect(priceLabel(row('A', 115, 115), 100, 5).label).toBe('Typical price')
    const above = priceLabel(row('A', 116, 116), 100, 5)
    expect(above.label).toBe('Above typical')
    expect(above.tone).toBe('bad')
    expect(above.detail).toBe('16% above the typical S$100.00.')
  })

  it('Test6: labels exactly double the typical price as above typical, over double as far above', () => {
    expect(priceLabel(row('A', 200, 200), 100, 5).label).toBe('Above typical')
    const far = priceLabel(row('A', 201, 201), 100, 5)
    expect(far.label).toBe('Far above typical')
    expect(far.tone).toBe('bad')
    expect(far.detail).toContain('More than twice the typical S$100.00.')
  })

  it('Test7: compares the total, so shipping can move a store into a higher band', () => {
    expect(priceLabel(row('A', 80, 120), 100, 5).label).toBe('Above typical')
  })
})

describe('TestSuite3: wasPriceLabel', () => {
  const stores = [row('A', 100, 100, 150), row('B', 110, 110), row('C', 120, 120)]

  it('Test1: returns null when the store shows no was price or one not above its price', () => {
    expect(wasPriceLabel(row('B', 110, 110), stores, 110)).toBe(null)
    expect(wasPriceLabel(row('A', 100, 100, 100), stores, 110)).toBe(null)
    expect(wasPriceLabel(row('A', 100, 100, 90), stores, 110)).toBe(null)
  })

  it('Test2: calls a was price above every other store inflated', () => {
    const result = wasPriceLabel(stores[0], stores, 110)
    expect(result.label).toBe('Was price looks inflated')
    expect(result.tone).toBe('bad')
    expect(result.detail).toBe('No other store charges S$150.00. The highest is S$120.00.')
  })

  it('Test3: accepts a was price equal to the highest other store price', () => {
    const equal = [row('A', 100, 100, 120), row('B', 110, 110), row('C', 120, 120)]
    const result = wasPriceLabel(equal[0], equal, 110)
    expect(result.label).toBe('Was price matches other stores')
    expect(result.tone).toBe('good')
    expect(result.detail).toBe('Other stores charge up to S$120.00 today.')
  })

  it('Test4: ignores stores far above the typical price when it looks for the highest price', () => {
    const withBundle = [row('A', 100, 100, 150), row('B', 110, 110), row('C', 120, 120), row('D', 400, 300)]
    expect(wasPriceLabel(withBundle[0], withBundle, 110).label).toBe('Was price looks inflated')
  })

  it('Test5: returns null when no other store can be compared', () => {
    const alone = [row('A', 100, 100, 150)]
    expect(wasPriceLabel(alone[0], alone, null)).toBe(null)
  })
})

describe('TestSuite4: saleSoon', () => {
  it('Test1: finds the next sale and says how many days away it is', () => {
    const sale = saleSoon('Shopee', OCT_31)
    expect(sale.event).toBe('11.11 sale')
    expect(sale.big).toBe(true)
    expect(sale.days).toBe(11)
    expect(sale.text).toBe('Shopee usually runs the 11.11 sale in 11 days. Not guaranteed.')
  })

  it('Test2: says tomorrow one day before and today on the day', () => {
    expect(saleSoon('Shopee', NOV_10).days).toBe(1)
    expect(saleSoon('Shopee', NOV_10).text).toContain('11.11 sale tomorrow.')
    expect(saleSoon('Shopee', NOV_11).days).toBe(0)
    expect(saleSoon('Shopee', NOV_11).text).toContain('11.11 sale today.')
  })

  it('Test3: uses the Singapore day, which changes at 16:00 UTC', () => {
    expect(saleSoon('Shopee', Date.UTC(2026, 10, 10, 15, 59)).days).toBe(1)
    expect(saleSoon('Shopee', Date.UTC(2026, 10, 10, 16, 0)).days).toBe(0)
  })

  it('Test4: moves to the next sale after the last one of the day has passed', () => {
    const sale = saleSoon('Lazada', Date.UTC(2026, 10, 11, 16, 0))
    expect(sale.event).toBe('12.12 sale')
    expect(sale.days).toBe(30)
  })

  it('Test5: rolls over into the next year', () => {
    const sale = saleSoon('Shopee', Date.UTC(2026, 11, 13, 4, 0))
    expect(sale.event).toBe('1.1 sale')
    expect(sale.big).toBe(false)
    expect(sale.days).toBe(19)
  })

  it('Test6: matches the store name without caring about capitals or extra words', () => {
    expect(saleSoon('LAZADA Singapore', OCT_31).text).toContain('Lazada usually runs')
    expect(saleSoon('shopee mall', OCT_31).text).toContain('Shopee usually runs')
  })

  it('Test7: returns null for a store with no known sales or an empty name', () => {
    expect(saleSoon('Amazon.sg', OCT_31)).toBe(null)
    expect(saleSoon('', OCT_31)).toBe(null)
    expect(saleSoon(undefined, OCT_31)).toBe(null)
  })
})

describe('TestSuite5: dealCheck', () => {
  it('Test1: puts the price label, was price label and sale in one result', () => {
    const stores = [row('Shopee', 100, 100, 150), row('B', 130, 130), row('C', 140, 140)]
    const result = dealCheck(stores[0], stores, typicalPrice(stores), OCT_31)
    expect(result.price.label).toBe('Good price')
    expect(result.was.label).toBe('Was price looks inflated')
    expect(result.sale.event).toBe('11.11 sale')
  })

  it('Test2: gives null for the was price and the sale when neither applies', () => {
    const stores = [row('B', 110, 110), row('C', 120, 120)]
    const result = dealCheck(stores[0], stores, null, OCT_31)
    expect(result.price.label).toBe('Too few stores to compare')
    expect(result.was).toBe(null)
    expect(result.sale).toBe(null)
  })
})
