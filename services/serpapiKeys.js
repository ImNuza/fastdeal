// SerpApi calls with up to three keys: SERPAPI_API_KEY, SERPAPI_API_KEY_2 and SERPAPI_API_KEY_3.
// Each free key has its own monthly searches. When SerpApi says a key ran out of searches
// (or the key is wrong), the call is tried again with the next key, and that key stays in use
// until the server restarts. A key that is not set is skipped, so one key works too.
import { getJson } from 'serpapi'

let current = 0

// Read when called, not at import: server.js loads .env first, but tests and scripts may not.
function serpKeys() {
  return [process.env.SERPAPI_API_KEY, process.env.SERPAPI_API_KEY_2, process.env.SERPAPI_API_KEY_3]
    .filter(Boolean)
}

export function hasSerpKey() {
  return serpKeys().length > 0
}

// The serpapi library rejects a non-200 answer with the raw body text, so check both forms.
function keyUsedUp(error) {
  const message = String((error && error.message) || error || '')
  return /run out of searches|invalid api key/i.test(message)
}

// getJson from the serpapi library, with the api_key filled in. Throws like getJson.
export async function serpGet(params) {
  const keys = serpKeys()
  if (!keys.length) throw new Error('SERPAPI_API_KEY is not set')
  for (let tries = 0; tries < keys.length; tries++) {
    const index = (current + tries) % keys.length
    try {
      const json = await getJson({ ...params, api_key: keys[index] })
      if (json && json.error && keyUsedUp(json.error)) throw json.error
      current = index
      return json
    } catch (error) {
      if (!keyUsedUp(error) || tries === keys.length - 1) throw error
      console.error('[SerpApi] key ' + (index + 1) + ' cannot search, trying the next key')
    }
  }
}
