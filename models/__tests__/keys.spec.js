// keys.spec.js
// Used by vitest to test the key rules in models/product-key.js and models/pair-key.js

import { describe, it, expect } from 'vitest'
import { toProductKey } from '../product-key.js'
import { toPairKey } from '../pair-key.js'

describe('TestSuite1: toProductKey', () => {
  it('Test1: turns capitals into lowercase', () => {
    expect(toProductKey('Sony WH-1000XM5')).toBe('sony wh-1000xm5')
    expect(toProductKey('IPHONE')).toBe('iphone')
  })

  it('Test2: trims spaces at both ends', () => {
    expect(toProductKey('  sony  ')).toBe('sony')
    expect(toProductKey('\tsony\n')).toBe('sony')
  })

  it('Test3: collapses runs of spaces, tabs and new lines inside the name into one space', () => {
    expect(toProductKey('  Sony  WH-1000XM5 ')).toBe('sony wh-1000xm5')
    expect(toProductKey('a \t\n b')).toBe('a b')
  })

  it('Test4: keeps punctuation and digits as they are', () => {
    expect(toProductKey('Galaxy S25+ (256GB)')).toBe('galaxy s25+ (256gb)')
  })

  it('Test5: gives the same key for names that differ only in case and spacing', () => {
    expect(toProductKey('  APPLE   airpods PRO ')).toBe(toProductKey('apple airpods pro'))
  })

  it('Test6: turns a non-string into text and gives an empty key for blank input', () => {
    expect(toProductKey(123)).toBe('123')
    expect(toProductKey('   ')).toBe('')
  })
})

describe('TestSuite2: toPairKey', () => {
  it('Test1: joins the two uids with a bar, smaller first', () => {
    expect(toPairKey('marvel', 'zoe')).toBe('marvel|zoe')
  })

  it('Test2: gives the same key for both uid orders', () => {
    expect(toPairKey('zoe', 'marvel')).toBe('marvel|zoe')
    expect(toPairKey('zoe', 'marvel')).toBe(toPairKey('marvel', 'zoe'))
  })

  it('Test3: gives different keys for different pairs', () => {
    expect(toPairKey('a', 'b')).not.toBe(toPairKey('a', 'c'))
  })
})
