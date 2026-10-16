// Server-side (Node/Express) search model for FastDeal.
// Flow: HomeView -> GET /api/search?q= -> search(q) -> SerpAPI (Google Shopping).
// search() RETURNS a normalized { query, productKey, listings, ... } object (also the
// HTTP response body) but WRITES the FULL RAW SerpAPI json to src/mock/tempitem.json
// (CompareView reads shopping_results from that raw file via GET /api/tempitem).
// A normalized copy is also written to src/mock/last-search.json.
//
// Pre-processing: the raw user query is sent to Gemini, which returns a tighter
// search term and a conservative minimum retail price (USD). Any Gemini failure
// falls back to the raw query so search always runs.

import { getJson } from 'serpapi'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { toProductKey } from './product-key.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Keys are read at module scope; server.js does `import 'dotenv/config'` BEFORE it
// imports this model, so process.env is already populated when these evaluate.
const API_KEY = process.env.SERPAPI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const GEMINI_MODEL = 'gemini-3.5-flash-lite'
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// Where the results are written for the frontend to read.
const TEMP_ITEM_PATH = path.join(__dirname, '..', 'src', 'mock', 'tempitem.json')
const LAST_SEARCH_PATH = path.join(__dirname, '..', 'src', 'mock', 'last-search.json')

// Extract the first {...} JSON object from Gemini's text, tolerating ```json fences
// and stray prose around it. Returns the parsed object, or null on any failure.
function parseGeminiJson(text) {
  if (!text || typeof text !== 'string') return null
  try {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

// Send the raw user query to Gemini and get back a tightened search term plus a
// conservative minimum retail price (USD). Any problem -> fall back to the raw query.
async function preprocess(rawQuery) {
  const fallback = { searchTerm: rawQuery, minPrice: null }
  if (!GEMINI_API_KEY) return fallback

  const prompt =
    `Given the product search '${rawQuery}':\n` +
    `1. Output a tight, optimized Google Shopping search term (keep brand, model, ` +
    `and key specs; drop filler words).\n` +
    `2. Estimate a conservative minimum retail price (in USD).\n` +
    `Return JSON only: {"query": str, "min_price": int}`

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    })
    if (!res.ok) return fallback

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    const parsed = parseGeminiJson(text)
    if (!parsed) return fallback

    const searchTerm =
      typeof parsed.query === 'string' && parsed.query.trim()
        ? parsed.query.trim()
        : rawQuery
    const minPrice =
      Number.isFinite(parsed.min_price) && parsed.min_price > 0
        ? Math.round(parsed.min_price)
        : null

    return { searchTerm, minPrice }
  } catch {
    return fallback
  }
}

// Normalize one raw SerpAPI shopping_results item into a card row.
function toRow(item) {
  return {
    name: item.title || '',
    image: item.thumbnail || '',
    store: item.source || 'Unknown',
    price: Number(item.extracted_price) || 0,
    rating: Number(item.rating) || 0,
    reviews: Number(item.reviews) || 0,
    link: item.product_link || item.link || '',
    productId: item.product_id || ''
  }
}

export async function search(q) {
  if (!API_KEY) throw new Error('SERPAPI_API_KEY is not set')

  const rawQuery = String(q || '').trim()
  if (!rawQuery) throw new Error('Query is required')

  const pre = await preprocess(rawQuery)

  // Quote the search term for exact-phrase matching.
  const fullQuery = `"${pre.searchTerm}"`

  const params = {
    engine: 'google_shopping',
    q: fullQuery,
    hl: 'en',
    gl: 'sg',
    api_key: API_KEY
  }
  if (pre.minPrice != null) {
    params.min_price = String(pre.minPrice)
  }

  // First attempt (with min_price when we have one).
  let json = await getJson(params)
  let minPriceApplied = pre.minPrice

  // Empty-result retry: if min_price was set and nothing came back, drop it and retry.
  const firstCount = Array.isArray(json.shopping_results) ? json.shopping_results.length : 0
  if (firstCount === 0 && params.min_price != null) {
    const retryParams = { ...params }
    delete retryParams.min_price
    json = await getJson(retryParams)
    minPriceApplied = null
  }

  // Write the FULL RAW SerpAPI response for CompareView to read.
  fs.writeFileSync(TEMP_ITEM_PATH, JSON.stringify(json, null, 2), 'utf8')

  const results = Array.isArray(json.shopping_results) ? json.shopping_results : []
  const listings = results
    .map(toRow)
    .filter((r) => r.price > 0)
    .slice(0, 10)

  const result = {
    query: rawQuery,
    productKey: toProductKey(rawQuery),
    searchTerm: pre.searchTerm,
    fullQuery,
    minPrice: minPriceApplied,
    listings,
    fetchedAt: new Date().toISOString()
  }

  // Write the normalized result too.
  fs.writeFileSync(LAST_SEARCH_PATH, JSON.stringify(result, null, 2), 'utf8')

  return result
}
