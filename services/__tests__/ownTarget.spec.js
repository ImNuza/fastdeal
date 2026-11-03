// ownTarget.spec.js
// Used by vitest to test ownTarget in services/targetPriceEmail.js: which saved target is the
// shopper's own and which is the built-in alarm 10% under the saved price.

import { describe, it, expect } from 'vitest'
import { ownTarget } from '../targetPriceEmail.js'

describe('TestSuite1: ownTarget', () => {
  it('Test1: a typed target is the shopper\'s own, even at exactly 10% under', () => {
    expect(ownTarget({ targetPrice: 90, savedPrice: 100, targetSource: 'user' })).toBe(90)
  })

  it('Test2: an old automatic target at exactly 10% under is the built-in alarm', () => {
    expect(ownTarget({ targetPrice: 90, savedPrice: 100, targetSource: null })).toBe(null)
    expect(ownTarget({ targetPrice: 321.44, savedPrice: 357.15, targetSource: null })).toBe(null)
  })

  it('Test3: any other saved target counts as the shopper\'s own', () => {
    expect(ownTarget({ targetPrice: 80, savedPrice: 100, targetSource: null })).toBe(80)
  })

  it('Test4: no target gives null', () => {
    expect(ownTarget({ targetPrice: null, savedPrice: 100 })).toBe(null)
    expect(ownTarget({ targetPrice: 0, savedPrice: 100 })).toBe(null)
  })
})
