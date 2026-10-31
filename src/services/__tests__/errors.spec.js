// errors.spec.js
// Used by vitest to test the error page text in src/services/errors.js

import { describe, it, expect } from 'vitest'
import { errorInfo } from '../errors.js'

describe('TestSuite1: errorInfo', () => {
  it('Test1: gives the code as the label for a known error', () => {
    expect(errorInfo(404).label).toBe('404')
    expect(errorInfo(404).title).toBe('Page not found')
    expect(errorInfo(403).title).toBe('Access denied')
  })

  it('Test2: offers Try again only for errors a reload might fix', () => {
    expect(errorInfo(500).retry).toBe(true)
    expect(errorInfo(503).retry).toBe(true)
    expect(errorInfo(404).retry).toBeFalsy()
    expect(errorInfo(403).retry).toBeFalsy()
  })

  it('Test3: shows Oops, not a number, when there is no connection', () => {
    expect(errorInfo('offline').label).toBe('Oops')
    expect(errorInfo('offline').title).toBe('No connection')
    expect(errorInfo('offline').retry).toBe(true)
  })

  it('Test4: falls back to a general message for an unknown code', () => {
    expect(errorInfo(418).label).toBe('418')
    expect(errorInfo(418).title).toBe('Something went wrong')
    expect(errorInfo(418).message).toBe('Please try again in a moment.')
  })
})
