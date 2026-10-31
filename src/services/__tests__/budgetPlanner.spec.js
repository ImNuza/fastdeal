// budgetPlanner.spec.js
// Used by vitest to test planBudget in src/services/budgetPlanner.js

import { describe, it, expect } from 'vitest'
import { planBudget } from '../budgetPlanner.js'

function item(name, price, rank) {
  return { name: name, price: price, store: 'Shopee', rank: rank || 0 }
}

function names(option) {
  return option.items.map(function (i) { return i.name }).sort()
}

describe('TestSuite1: planBudget', () => {
  it('Test1: returns no options for an empty list', () => {
    const plan = planBudget([], 100, 5)
    expect(plan.options).toEqual([])
    expect(plan.mustTotal).toBe(0)
    expect(plan.mustFits).toBe(true)
  })

  it('Test2: returns no options when no single item fits the budget', () => {
    const plan = planBudget([item('A', 500), item('B', 600)], 100, 5)
    expect(plan.options).toEqual([])
  })

  it('Test3: puts the mix that holds the most items first when there are no must haves', () => {
    // A + B = 30 and A + C = 40 fit 45, B + C = 50 does not
    const plan = planBudget([item('A', 10), item('B', 20), item('C', 30)], 45, 5)
    expect(names(plan.options[0])).toEqual(['A', 'C'])
    expect(plan.options[0].total).toBe(40)
    expect(plan.options[0].left).toBe(5)
  })

  it('Test4: never goes over the budget and reports the money left', () => {
    const plan = planBudget([item('A', 10), item('B', 20), item('C', 30), item('D', 45)], 60, 50)
    for (const option of plan.options) {
      expect(option.total).toBeLessThanOrEqual(60)
      expect(option.left).toBe(60 - option.total)
    }
  })

  it('Test5: accepts a mix that costs exactly the budget', () => {
    const plan = planBudget([item('A', 40), item('B', 60)], 100, 5)
    expect(names(plan.options[0])).toEqual(['A', 'B'])
    expect(plan.options[0].left).toBe(0)
  })

  it('Test6: rejects a mix that is 1 over the budget', () => {
    const plan = planBudget([item('A', 40), item('B', 61)], 100, 5)
    expect(plan.options.some(function (o) { return o.items.length === 2 })).toBe(false)
    expect(plan.options.length).toBe(2)
  })

  it('Test7: counts each set of items once, whatever the order', () => {
    // 3 items that all fit give 2^3 - 1 = 7 different mixes
    const plan = planBudget([item('A', 1), item('B', 2), item('C', 3)], 100, 100)
    const keys = plan.options.map(function (o) { return names(o).join('+') })
    expect(plan.options.length).toBe(7)
    expect(new Set(keys).size).toBe(7)
  })

  it('Test8: stops at the option limit', () => {
    const items = [item('A', 1), item('B', 2), item('C', 3)]
    expect(planBudget(items, 100, 3).options.length).toBe(3)
    expect(planBudget(items, 100, 1).options.length).toBe(1)
    expect(planBudget(items, 100, 0).options.length).toBe(0)
  })

  it('Test9: ranks a must have #1 above must haves #2 and #3 together', () => {
    // m1 alone costs 60. m2 + m3 cost 80 and keep two must haves, but not #1.
    const items = [item('m1', 60, 1), item('m2', 40, 2), item('m3', 40, 3)]
    const plan = planBudget(items, 80, 5)
    expect(names(plan.options[0])).toEqual(['m1'])
    expect(plan.mustFits).toBe(false)
    expect(plan.mustTotal).toBe(140)
  })

  it('Test10: ranks a mix that keeps a must have above a mix with more items', () => {
    const items = [item('M', 35, 1), item('a', 5), item('b', 5), item('c', 5)]
    const plan = planBudget(items, 40, 5)
    const best = plan.options[0]
    expect(names(best)).toContain('M')
    expect(best.items.length).toBe(2)
    expect(best.total).toBe(40)
  })

  it('Test11: says the must haves fit when their total is within the budget', () => {
    const plan = planBudget([item('M1', 30, 1), item('M2', 20, 2), item('x', 50)], 50, 5)
    expect(plan.mustFits).toBe(true)
    expect(plan.mustTotal).toBe(50)
    expect(names(plan.options[0])).toEqual(['M1', 'M2'])
  })

  it('Test12: mixes only the 16 cheapest items when the list is longer', () => {
    const items = []
    for (let price = 1; price <= 20; price++) {
      items.push(item('item' + price, price))
    }
    const plan = planBudget(items, 1000, 5)
    expect(plan.options[0].items.length).toBe(16)
    expect(plan.options[0].total).toBe(136)
    expect(names(plan.options[0])).not.toContain('item17')
  })

  it('Test13: keeps a must have in the mix even when it is not among the 16 cheapest', () => {
    const items = [item('M', 500, 1)]
    for (let i = 1; i <= 17; i++) {
      items.push(item('cheap' + i, 1))
    }
    const plan = planBudget(items, 600, 5)
    expect(names(plan.options[0])).toContain('M')
    expect(plan.options[0].items.length).toBe(16)
    expect(plan.options[0].total).toBe(515)
  })
})
