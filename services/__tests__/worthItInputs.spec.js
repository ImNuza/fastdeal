// worthItInputs.spec.js
// Used by vitest to test what the AI "Worth it?" verdict reads, in services/worthItInputs.js

import { describe, it, expect } from 'vitest'
import { verdictInputs, verdictPrompt, ruleVerdict } from '../worthItInputs.js'

// A listing row as the product page has it
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
  it('Test1: reads the cheapest listing, typical price and range from the search listings', () => {
    const { rows } = verdictInputs(PRODUCT, SALE)
    expect(row(rows, 'cheapest').value).toBe('S$30.00 at Shopee')
    expect(row(rows, 'typical').value).toBe('S$40.00, the middle price of 3 listings')
    expect(row(rows, 'range').value).toBe('S$30.00 to S$60.00 across 3 listings')
  })

  it('Test2: lists the stores that show a was price', () => {
    const { rows } = verdictInputs(PRODUCT, SALE)
    expect(row(rows, 'sale-now').value).toBe('Shopee (was S$45.00, now S$30.00)')
  })

  it('Test3: sends the next big sale from the sale calendar', () => {
    const { rows } = verdictInputs(PRODUCT, SALE)
    expect(row(rows, 'next-sale').value).toBe('11.11 sale on 11 Nov, in 11 days')
    expect(row(rows, 'next-sale').sent).toBe(true)
  })

  it('Test4: has no price history row, because FastDeal does not track price history', () => {
    const { rows } = verdictInputs(PRODUCT, SALE)
    expect(rows.map(function (r) { return r.key })).toEqual(['product', 'pick', 'cheapest', 'typical', 'range', 'sale-now', 'rating', 'next-sale'])
  })

  it('Test5: marks a missing typical price and rating as not sent', () => {
    const product = { title: 'Rare thing', stores: [store('eBay', 99)] }
    const { rows } = verdictInputs(product, null)
    expect(row(rows, 'typical').sent).toBe(false)
    expect(row(rows, 'rating').sent).toBe(false)
    expect(row(rows, 'next-sale').sent).toBe(false)
    expect(row(rows, 'range').value).toBe('S$99.00 to S$99.00 across 1 listing')
  })

  it('Test6: writes a short Based on summary', () => {
    expect(verdictInputs(PRODUCT, SALE).summary).toBe('Your pick S$30.00 (the cheapest), usual S$40.00, 1 on sale now, 11.11 in 11 days.')
  })

  it('Test7: reads the listing the shopper picked, and names a listing that can be another model', () => {
    const pick = { ...store('Lazada', 40), name: 'Pikachu Plush 30cm' }
    const { rows, summary } = verdictInputs({ ...PRODUCT, pick: pick }, SALE)
    expect(row(rows, 'pick').value).toBe('S$40.00 at Lazada, listed as "Pikachu Plush 30cm"')
    expect(summary).toBe('Your pick S$40.00, cheapest S$30.00, usual S$40.00, 1 on sale now, 11.11 in 11 days.')
  })

  it('Test8: uses the cheapest listing as the pick when the search no longer has the clicked one', () => {
    const { rows } = verdictInputs({ ...PRODUCT, pick: null }, SALE)
    expect(row(rows, 'pick').value).toBe('S$30.00 at Shopee')
  })
})

describe('TestSuite2: verdictPrompt', () => {
  it('Test1: puts only the sent rows in the prompt', () => {
    const { rows } = verdictInputs(PRODUCT, SALE)
    const prompt = verdictPrompt(rows)
    expect(prompt).toContain('- Your pick: S$30.00 at Shopee')
    expect(prompt).toContain('- Cheapest listing: S$30.00 at Shopee')
    expect(prompt).toContain('- Next big sale: 11.11 sale on 11 Nov, in 11 days')
    expect(prompt).not.toContain('Price history')
  })

  it('Test2: tells the AI not to invent prices and to answer in JSON', () => {
    const prompt = verdictPrompt(verdictInputs(PRODUCT, SALE).rows)
    expect(prompt).toContain('Do not invent past prices')
    expect(prompt).toContain('"decision": "buy" | "wait"')
  })

  it('Test3: tells the AI that a listing can be a different model', () => {
    const prompt = verdictPrompt(verdictInputs(PRODUCT, SALE).rows)
    expect(prompt).toContain('A listing can be a different model, size or condition')
  })
})

describe('TestSuite3: ruleVerdict', () => {
  it('Test1: says buy when the pick is 10% or more under the typical price', () => {
    const verdict = ruleVerdict(PRODUCT, SALE)
    expect(verdict.decision).toBe('buy')
    expect(verdict.source).toBe('rules')
    expect(verdict.reason).toBe('Your pick S$30.00 is 25% under the usual S$40.00 across 3 listings.')
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

  it('Test5: judges the pick, not the cheapest listing, and says wait when it is 10% or more over typical', () => {
    const verdict = ruleVerdict({ ...PRODUCT, pick: store('Amazon.sg', 60) }, { ...SALE, daysAway: 40 })
    expect(verdict.decision).toBe('wait')
    expect(verdict.reason).toBe('Your pick S$60.00 is 50% over the usual S$40.00 across 3 listings. Check the cheaper listings below.')
  })
})
