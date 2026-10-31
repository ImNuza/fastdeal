// @vitest-environment jsdom
// searchHistory.spec.js
// Used by vitest to test the search history in src/services/searchHistory.js (needs localStorage)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { readHistory, addToHistory, removeFromHistory } from '../searchHistory.js'

const KEY = 'fastdeal-search-history'

beforeEach(() => {
  // Newer Node versions define their own global localStorage, which hides the jsdom one.
  // Give each test a fresh jsdom storage so the test behaves the same on every Node version.
  const dom = new JSDOM('', { url: 'http://localhost/' })
  vi.stubGlobal('localStorage', dom.window.localStorage)
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TestSuite1: readHistory', () => {
  it('Test1: returns an empty list when nothing is saved', () => {
    expect(readHistory()).toEqual([])
  })

  it('Test2: returns an empty list when the saved text is not valid JSON', () => {
    localStorage.setItem(KEY, '{not json')
    expect(readHistory()).toEqual([])
  })

  it('Test3: returns an empty list when the saved value is not an array', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 1 }))
    expect(readHistory()).toEqual([])
  })

  it('Test4: returns only the first 5 saved searches', () => {
    localStorage.setItem(KEY, JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f', 'g']))
    expect(readHistory()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('TestSuite2: addToHistory', () => {
  it('Test1: puts the newest search first and saves it', () => {
    addToHistory('airpods')
    addToHistory('sony')
    expect(addToHistory('switch')).toEqual(['switch', 'sony', 'airpods'])
    expect(readHistory()).toEqual(['switch', 'sony', 'airpods'])
  })

  it('Test2: moves a repeated search to the top without a duplicate, ignoring capitals', () => {
    addToHistory('airpods')
    addToHistory('sony')
    expect(addToHistory('AirPods')).toEqual(['AirPods', 'sony'])
  })

  it('Test3: keeps at most 5 searches and drops the oldest', () => {
    for (const q of ['a', 'b', 'c', 'd', 'e', 'f']) {
      addToHistory(q)
    }
    expect(readHistory()).toEqual(['f', 'e', 'd', 'c', 'b'])
  })

  it('Test4: trims the search and ignores a blank one', () => {
    addToHistory('  sony  ')
    expect(addToHistory('   ')).toEqual(['sony'])
    expect(addToHistory('')).toEqual(['sony'])
    expect(addToHistory(undefined)).toEqual(['sony'])
    expect(readHistory()).toEqual(['sony'])
  })
})

describe('TestSuite3: removeFromHistory', () => {
  it('Test1: removes one search, ignoring capitals, and saves the rest', () => {
    addToHistory('airpods')
    addToHistory('sony')
    expect(removeFromHistory('AIRPODS')).toEqual(['sony'])
    expect(readHistory()).toEqual(['sony'])
  })

  it('Test2: leaves the list alone when the search is not there', () => {
    addToHistory('airpods')
    expect(removeFromHistory('kettle')).toEqual(['airpods'])
    expect(removeFromHistory('')).toEqual(['airpods'])
  })
})
