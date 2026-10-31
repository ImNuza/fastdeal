// itemName.spec.js
// Used by vitest to test itemName in src/services/itemName.js

import { describe, it, expect } from 'vitest'
import { itemName } from '../itemName.js'

describe('TestSuite1: itemName', () => {
  it('Test1: gives an all lowercase word a capital first letter', () => {
    expect(itemName('sony headphones')).toBe('Sony Headphones')
    expect(itemName('x')).toBe('X')
  })

  it('Test2: puts a word with digits (a model number) in all capitals', () => {
    expect(itemName('wh-1000xm5')).toBe('WH-1000XM5')
    expect(itemName('galaxy s25')).toBe('Galaxy S25')
  })

  it('Test3: treats digits as a model number even when the word has mixed case', () => {
    expect(itemName('iPhone15')).toBe('IPHONE15')
  })

  it('Test4: leaves a mixed case word without digits as typed', () => {
    expect(itemName('iPhone')).toBe('iPhone')
    expect(itemName('PlayStation controller')).toBe('PlayStation Controller')
    expect(itemName('SONY tv')).toBe('SONY Tv')
  })

  it('Test5: trims the term and collapses extra spaces between words', () => {
    expect(itemName('  sony   wh-1000xm5  ')).toBe('Sony WH-1000XM5')
  })

  it('Test6: gives an empty text for an empty, blank or missing term', () => {
    expect(itemName('')).toBe('')
    expect(itemName('   ')).toBe('')
    expect(itemName(undefined)).toBe('')
    expect(itemName(null)).toBe('')
  })
})
