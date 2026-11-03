// geminiKeys.spec.js
// Used by vitest to test the Gemini key fallback in services/geminiKeys.js.
// fetch is replaced, so these tests never call Gemini.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const KEYS = ['GEMINI_API_KEY']
for (let n = 2; n <= 10; n++) KEYS.push('GEMINI_API_KEY_' + n)

const BASE = 'https://example.test/models'

// A fresh copy of the module each test, so the remembered key starts at the first one
async function load() {
  vi.resetModules()
  return import('../geminiKeys.js')
}

// The key= value of the URL in fetch call number i
function keyOf(fetchMock, i) {
  return new URL(fetchMock.mock.calls[i][0]).searchParams.get('key')
}

describe('TestSuite1: geminiFetch', () => {
  let fetchMock

  beforeEach(() => {
    KEYS.forEach((name) => vi.stubEnv(name, ''))
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('Test1: uses the first key when it works', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'key-1')
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    const { geminiFetch } = await load()
    const res = await geminiFetch(BASE, 'model-x', {})
    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(keyOf(fetchMock, 0)).toBe('key-1')
  })

  it('Test2: moves to the next key when a key fails, and keeps using it', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'key-1')
    vi.stubEnv('GEMINI_API_KEY_2', 'key-2')
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValue({ ok: true, status: 200 })
    const { geminiFetch } = await load()
    await geminiFetch(BASE, 'model-x', {})
    expect(keyOf(fetchMock, 1)).toBe('key-2')

    // The next call starts with the key that worked
    await geminiFetch(BASE, 'model-x', {})
    expect(keyOf(fetchMock, 2)).toBe('key-2')
  })

  it('Test3: reads a key numbered above 2, and skips a key that is not set', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'key-1')
    vi.stubEnv('GEMINI_API_KEY_4', 'key-4')
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValue({ ok: true, status: 200 })
    const { geminiFetch } = await load()
    await geminiFetch(BASE, 'model-x', {})
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(keyOf(fetchMock, 1)).toBe('key-4')
  })

  it('Test4: gives back the last failed answer when every key fails', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'key-1')
    vi.stubEnv('GEMINI_API_KEY_2', 'key-2')
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    const { geminiFetch } = await load()
    const res = await geminiFetch(BASE, 'model-x', {})
    expect(res.status).toBe(500)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('Test5: throws when no key is set', async () => {
    const { geminiFetch, hasGeminiKey } = await load()
    expect(hasGeminiKey()).toBe(false)
    await expect(geminiFetch(BASE, 'model-x', {})).rejects.toThrow('GEMINI_API_KEY is not set')
  })
})
