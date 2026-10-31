// storeUrl.spec.js
// Used by vitest to test the store link fix in services/productService.js

import { describe, it, expect } from 'vitest'
import { storeUrl } from '../productService.js'

describe('TestSuite1: storeUrl', () => {
  it('Test1: gives a Google redirect link with no domain the google.com domain', () => {
    expect(storeUrl('/goto?url=CAES123')).toBe('https://www.google.com/goto?url=CAES123')
  })

  it('Test2: keeps a full store link as it is', () => {
    expect(storeUrl('https://shopee.sg/product/1/2')).toBe('https://shopee.sg/product/1/2')
  })

  it('Test3: gives an empty string when there is no link', () => {
    expect(storeUrl(undefined)).toBe('')
    expect(storeUrl('')).toBe('')
  })
})
