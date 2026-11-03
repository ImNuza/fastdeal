// Gemini calls with up to ten keys: GEMINI_API_KEY, then GEMINI_API_KEY_2 to GEMINI_API_KEY_10.
// Each free key has its own quota. When a Gemini request fails with the current key
// (quota/auth/rate-limit, or any other error or network failure), the call is tried
// again with the next key, and that key stays in use until the server restarts.
// A key that is not set is skipped, so one key works too. This mirrors services/serpapiKeys.js.

let current = 0

// The highest key number read. A new key only needs to be added to .env (and Render).
const MAX_KEYS = 10

// Read when called, not at import: server.js loads .env first, but tests and scripts may not.
function geminiKeys() {
  const keys = [process.env.GEMINI_API_KEY]
  for (let n = 2; n <= MAX_KEYS; n++) {
    keys.push(process.env['GEMINI_API_KEY_' + n])
  }
  return keys.filter(Boolean)
}

export function hasGeminiKey() {
  return geminiKeys().length > 0
}

// Build the request URL for a given model and key. generateContent is the only Gemini
// endpoint FastDeal uses; the key goes on the query string, as every call site did before.
function geminiUrl(base, model, key) {
  return `${base}/${model}:generateContent?key=${key}`
}

// Call Gemini generateContent, trying each configured key in turn. Rotates to the next key
// on ANY failure (non-ok HTTP response OR a thrown network error) and remembers the working
// key. Returns the Response from the first key that answers with res.ok, or the LAST response
// when every key failed (so callers keep their existing !res.ok / parse-failure fallbacks).
// Throws only when no key is set, or when the final key throws a network error (same shape as
// a bare fetch, so existing try/catch fallbacks still fire).
//
// base:  the models base URL, e.g. https://generativelanguage.googleapis.com/v1beta/models
// model: the model id, e.g. gemini-3.5-flash-lite
// init:  the fetch() options (method/headers/body) the call site already builds
export async function geminiFetch(base, model, init) {
  const keys = geminiKeys()
  if (!keys.length) throw new Error('GEMINI_API_KEY is not set')

  let lastResponse = null
  let lastError = null

  for (let tries = 0; tries < keys.length; tries++) {
    const index = (current + tries) % keys.length
    try {
      const res = await fetch(geminiUrl(base, model, keys[index]), init)
      if (res.ok) {
        current = index
        return res
      }
      // Non-ok: remember it, then try the next key (any error rotates the key).
      lastResponse = res
      if (tries < keys.length - 1) {
        console.error('[Gemini] key ' + (index + 1) + ' failed (HTTP ' + res.status + '), trying the next key')
      }
    } catch (error) {
      // Network/fetch failure: remember it, then try the next key.
      lastError = error
      if (tries < keys.length - 1) {
        console.error('[Gemini] key ' + (index + 1) + ' threw, trying the next key')
      }
    }
  }

  // Every key failed. Return the last non-ok response if we got one, so the caller's
  // own !res.ok handling runs; otherwise re-throw the last network error.
  if (lastResponse) return lastResponse
  throw lastError || new Error('Gemini request failed')
}
