// worthItInputs.spec.js
// Used by vitest to test what the AI "Worth it?" verdict reads, in services/worthItInputs.js

import { describe, it, expect } from 'vitest'
import { verdictInputs, verdictPrompt, ruleVerdict } from '../worthItInputs.js'

// A store row as the product page has it
function store(name, price, oldPrice) {
  return { store: name, price: price, total: price, oldPrice: oldPrice || null }
}

const PRODUCT = {
  title: 'Pokemon Pikachu Plush',
  rating: 4.8,
  reviews: 334,
  typicalPrice: 40,
  stores: [store('Shopee', 30, 45), store('Lazada', 40), store('Amazon.sg', 60)]
}
const SALE = { name: '11.11 sale', day: '2026-11-11', daysAway: 11 }

function row(rows, key) {
  return rows.find(function (r) { return r.key === key })
}

describe('TestSuite1: verdictInputs', () => {
  it('Test1: reads the cheapest total, typical price and range from the live stores', () => {
    const { rows } = verdictInputs(PRODUCT, [], SALE)
    expect(row(rows, 'cheapest').value).toBe('S$30.00 at Shopee')
    expect(row(rows, 'typical').value).toBe('S$40.00, the middle total of 3 stores')
    expect(row(rows, 'range').value).toBe('S$30.00 to S$60.00 across 3 stores')
  })

  it('Test2: lists the stores that show a was price', () => {
    const { rows } = verdictInputs(PRODUCT, [], SALE)
    expect(row(rows, 'sale-now').value).toBe('Shopee (was S$45.00, now S$30.00)')
  })

  it('Test3: sends the next big sale from the sale calendar', () => {
    const { rows } = verdictInputs(PRODUCT, [], SALE)
    expect(row(rows, 'next-sale').value).toBe('11.11 sale on 11 Nov, in 11 days')
    expect(row(rows, 'next-sale').sent).toBe(true)
  })

  it('Test4: does not send price history with fewer than 3 tracked days', () => {
    const { rows } = verdictInputs(PRODUCT, [{ day: '2026-10-30', price: 35 }], SALE)
    expect(row(rows, 'history').sent).toBe(false)
    expect(row(rows, 'history').value).toBe('1 tracked day. It needs 3, so it was not sent')
  })

  it('Test5: sends the low and average with 3 or more tracked days', () => {
    const history = [{ day: '2026-10-29', price: 36 }, { day: '2026-10-30', price: 30 }, { day: '2026-10-31', price: 33 }]
    const { rows } = verdictInputs(PRODUCT, history, SALE)
    expect(row(rows, 'history').sent).toBe(true)
    expect(row(rows, 'history').value).toBe('Low S$30.00, average S$33.00 over 3 tracked days')
  })

  it('Test6: marks a missing typical price and rating as not sent', () => {
    const product = { title: 'Rare thing', stores: [store('eBay', 99)] }
    const { rows } = verdictInputs(product, [], null)
    expect(row(rows, 'typical').sent).toBe(false)
    expect(row(rows, 'rating').sent).toBe(false)
    expect(row(rows, 'next-sale').sent).toBe(false)
    expect(row(rows, 'range').value).toBe('S$99.00 to S$99.00 across 1 store')
  })

  it('Test7: writes a short Based on summary', () => {
    expect(verdictInputs(PRODUCT, [], SALE).summary).toBe('Cheapest S$30.00, typical S$40.00, 1 on sale now, 11.11 in 11 days.')
  })
})

describe('TestSuite2: verdictPrompt', () => {
  it('Test1: puts only the sent rows in the prompt', () => {
    const { rows } = verdictInputs(PRODUCT, [], SALE)
    const prompt = verdictPrompt(rows)
    expect(prompt).toContain('- Cheapest total now: S$30.00 at Shopee')
    expect(prompt).toContain('- Next big sale: 11.11 sale on 11 Nov, in 11 days')
    expect(prompt).not.toContain('Price history')
  })

  it('Test2: tells the AI not to invent prices and to answer in JSON', () => {
    const prompt = verdictPrompt(verdictInputs(PRODUCT, [], SALE).rows)
    expect(prompt).toContain('Do not invent past prices')
    expect(prompt).toContain('"decision": "buy" | "wait"')
  })
})

describe('TestSuite3: ruleVerdict', () => {
  it('Test1: says buy when the cheapest is 10% or more under the typical price', () => {
    const verdict = ruleVerdict(PRODUCT, SALE)
    expect(verdict.decision).toBe('buy')
    expect(verdict.source).toBe('rules')
    expect(verdict.reason).toBe('The cheapest total S$30.00 is 25% under the typical S$40.00 across 3 stores.')
  })

  it('Test2: says wait when the price is close to typical and a big sale is near', () => {
    const product = { ...PRODUCT, stores: [store('Shopee', 38), store('Lazada', 40), store('Amazon.sg', 42)] }
    const verdict = ruleVerdict(product, SALE)
    expect(verdict.decision).toBe('wait')
    expect(verdict.headline).toBe('Wait for 11.11')
  })

  it('Test3: says fair price when the price is close to typical and the sale is far away', () => {
    const product = { ...PRODUCT, stores: [store('Shopee', 38), store('Lazada', 40), store('Amazon.sg', 42)] }
    const verdict = ruleVerdict(product, { ...SALE, daysAway: 40 })
    expect(verdict.decision).toBe('buy')
    expect(verdict.headline).toBe('Fair price')
  })

  it('Test4: has no answer with no typical price and no sale soon', () => {
    const product = { title: 'Rare thing', stores: [store('eBay', 99)] }
    expect(ruleVerdict(product, { ...SALE, daysAway: 40 })).toBe(null)
    expect(ruleVerdict(product, SALE).decision).toBe('wait')
  })
})
