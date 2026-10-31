// serpapiKeys.spec.js
// Used by vitest to test the SerpApi key fallback in services/serpapiKeys.js.
// The serpapi library is replaced, so these tests never call SerpApi.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const getJson = vi.fn()
vi.mock('serpapi', () => ({ getJson: getJson }))

const KEYS = ['SERPAPI_API_KEY', 'SERPAPI_API_KEY_2', 'SERPAPI_API_KEY_3']

// A fresh copy of the module each test, so the remembered key starts at the first one
async function load() {
  vi.resetModules()
  return import('../serpapiKeys.js')
}

describe('TestSuite1: serpGet', () => {
  beforeEach(() => {
    getJson.mockReset()
    KEYS.forEach((name) => vi.stubEnv(name, ''))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('Test1: uses the first key when it works', async () => {
    vi.stubEnv('SERPAPI_API_KEY', 'key-1')
    getJson.mockResolvedValue({ shopping_results: [] })
    const { serpGet } = await load()
    await serpGet({ engine: 'google_shopping', q: 'x' })
    expect(getJson).toHaveBeenCalledTimes(1)
    expect(getJson.mock.calls[0][0].api_key).toBe('key-1')
  })

  it('Test2: moves to the next key when a key ran out of searches', async () => {
    vi.stubEnv('SERPAPI_API_KEY', 'key-1')
    vi.stubEnv('SERPAPI_API_KEY_2', 'key-2')
    getJson
      .mockRejectedValueOnce('{"error":"Your account has run out of searches."}')
      .mockResolvedValue({ shopping_results: [] })
    const { serpGet } = await load()
    await serpGet({ q: 'x' })
    expect(getJson.mock.calls[1][0].api_key).toBe('key-2')

    // The next call starts with the key that worked
    await serpGet({ q: 'y' })
    expect(getJson.mock.calls[2][0].api_key).toBe('key-2')
  })

  it('Test3: skips a key that is not set', async () => {
    vi.stubEnv('SERPAPI_API_KEY_3', 'key-3')
    getJson.mockResolvedValue({})
    const { serpGet, hasSerpKey } = await load()
    expect(hasSerpKey()).toBe(true)
    await serpGet({ q: 'x' })
    expect(getJson.mock.calls[0][0].api_key).toBe('key-3')
  })

  it('Test4: throws other errors at once, without trying another key', async () => {
    vi.stubEnv('SERPAPI_API_KEY', 'key-1')
    vi.stubEnv('SERPAPI_API_KEY_2', 'key-2')
    getJson.mockRejectedValue(new Error('timeout'))
    const { serpGet } = await load()
    await expect(serpGet({ q: 'x' })).rejects.toThrow('timeout')
    expect(getJson).toHaveBeenCalledTimes(1)
  })

  it('Test5: throws when no key is set', async () => {
    const { serpGet, hasSerpKey } = await load()
    expect(hasSerpKey()).toBe(false)
    await expect(serpGet({ q: 'x' })).rejects.toThrow('SERPAPI_API_KEY is not set')
  })
})
