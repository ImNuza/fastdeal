// format.spec.js
// Used by vitest to test the helpers in src/services/format.js

import { describe, it, expect } from 'vitest'
import { sgd, storeLink, dayText } from '../format.js'

describe('TestSuite1: sgd', () => {
  it('Test1: writes S$ and always 2 decimal places', () => {
    expect(sgd(5)).toBe('S$5.00')
    expect(sgd(19.9)).toBe('S$19.90')
    expect(sgd(0)).toBe('S$0.00')
  })

  it('Test2: rounds to the nearest cent', () => {
    expect(sgd(9.994)).toBe('S$9.99')
    expect(sgd(9.999)).toBe('S$10.00')
    expect(sgd(0.1 + 0.2)).toBe('S$0.30')
  })

  it('Test3: reads a price given as text and puts no comma in big numbers', () => {
    expect(sgd('19.9')).toBe('S$19.90')
    expect(sgd(1234.5)).toBe('S$1234.50')
  })
})

describe('TestSuite2: storeLink', () => {
  it('Test1: links a known store to its own search for the product', () => {
    expect(storeLink('Shopee', 'airpods')).toBe('https://shopee.sg/search?keyword=airpods')
    expect(storeLink('Amazon.sg', 'airpods')).toBe('https://www.amazon.sg/s?k=airpods')
  })

  it('Test2: encodes spaces and symbols in the product name', () => {
    expect(storeLink('Lazada', 'Sony WH-1000XM5')).toBe('https://www.lazada.sg/catalog/?q=Sony%20WH-1000XM5')
    expect(storeLink('Qoo10', 'a&b=c')).toBe('https://www.qoo10.sg/s/?keyword=a%26b%3Dc')
  })

  it('Test3: gives an empty link for a store it does not know', () => {
    expect(storeLink('Unknown Store', 'airpods')).toBe('')
    expect(storeLink(undefined, 'airpods')).toBe('')
  })
})

describe('TestSuite3: dayText', () => {
  it('Test1: writes the day number and the short month name', () => {
    expect(dayText('2026-10-27')).toBe('27 Oct')
    expect(dayText('2026-12-31')).toBe('31 Dec')
  })

  it('Test2: drops the leading zero of the day and reads January as month 1', () => {
    expect(dayText('2026-01-05')).toBe('5 Jan')
    expect(dayText('2026-09-09')).toBe('9 Sep')
  })
})
