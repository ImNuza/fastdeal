// Server-side (Node/Express) search model for FastDeal.
// Flow: CompareView -> GET /api/search?q=&sid= -> search(q, sid) -> SerpAPI (Google Shopping).
// search() returns a normalized { query, productKey, searchTerm, listings, ... } object
// (also the HTTP response body). Results are saved in the searchCache collection for
// 6 hours, so the same search again uses no SerpApi credit. When the browser sent a
// session id, the search is also logged once per session in searchLogs.
//
// Pre-processing: the raw user query is sent to Gemini, which returns a tighter
// search term and a conservative minimum retail price (USD). Any Gemini failure
// falls back to the raw query so search always runs.

import { getJson } from 'serpapi'
import { toProductKey } from './product-key.js'
import SearchCache from './search-cache-model.js'
import SearchLog from './search-log-model.js'

// Keys are read at module scope; server.js does `import 'dotenv/config'` BEFORE it
// imports this model, so process.env is already populated when these evaluate.
const API_KEY = process.env.SERPAPI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const GEMINI_MODEL = 'gemini-3.5-flash-lite'
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// How long a saved search is reused before SerpApi is called again.
const CACHE_HOURS = 6

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
    productId: item.product_id || '',
    // The crossed-out "was" price, or null when the store shows none
    oldPrice: Number(item.extracted_old_price) || null,
    freeShipping: String(item.delivery || '').toLowerCase().includes('free'),
    // Needed by the product page to load every store for this product
    immersiveToken: item.immersive_product_page_token || ''
  }
}

// One anonymous searchLogs row per session per search, for Trending. A reload or
// coming back from a product page finds the row and adds nothing. Only searches from
// the search page send a session id, so background price checks (Sleep on it) do not
// count. productName and image are what the Trending page shows.
async function logSearch(sessionId, query, productKey, searchTerm, listings) {
  if (!sessionId) return
  try {
    await SearchLog.updateOne(
      { sessionId: String(sessionId), productKey },
      {
        $setOnInsert: {
          query,
          productName: searchTerm,
          image: (listings[0] && listings[0].image) || '',
          searchedAt: new Date()
        }
      },
      { upsert: true }
    )
  } catch (error) {
    console.error('searchLogs write failed:', error.message)
  }
}

export async function search(q, sessionId) {
  if (!API_KEY) throw new Error('SERPAPI_API_KEY is not set')

  const rawQuery = String(q || '').trim()
  if (!rawQuery) throw new Error('Query is required')
  const productKey = toProductKey(rawQuery)

  // Saved in the last CACHE_HOURS hours: return it and use no SerpApi credit.
  const cached = await SearchCache.findOne({ queryKey: productKey, expiresAt: { $gt: new Date() } }).lean()
  if (cached) {
    await logSearch(sessionId, rawQuery, productKey, cached.searchTerm || rawQuery, cached.listings)
    return {
      query: rawQuery,
      productKey,
      searchTerm: cached.searchTerm || rawQuery,
      listings: cached.listings,
      fetchedAt: cached.fetchedAt,
      cached: true
    }
  }

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

  const results = Array.isArray(json.shopping_results) ? json.shopping_results : []
  const listings = results
    .map(toRow)
    .filter((r) => r.price > 0)
    .slice(0, 10)

  const fetchedAt = new Date()

  // Save for the next CACHE_HOURS hours, then log the search.
  await SearchCache.findOneAndUpdate(
    { queryKey: productKey },
    {
      queryKey: productKey,
      searchTerm: pre.searchTerm,
      listings,
      fetchedAt,
      expiresAt: new Date(fetchedAt.getTime() + CACHE_HOURS * 3600000)
    },
    { upsert: true }
  )
  await logSearch(sessionId, rawQuery, productKey, pre.searchTerm, listings)

  return {
    query: rawQuery,
    productKey,
    searchTerm: pre.searchTerm,
    fullQuery,
    minPrice: minPriceApplied,
    listings,
    fetchedAt,
    cached: false
  }
}


export async function identifyImage(base64,mimeType) {
  const res=await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`,{
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
      contents: [{
        parts: [
          { text: 'Identify the retail product in this photo. Reply with ONLY the brand, ' +
                  'model and product type as a shopping search term (e.g. "Sony WH-1000XM5 headphones"). ' +
                  'If you are unsure of the model, give the brand and product type. ' +
                  'If there is no product, reply with exactly: UNKNOWN' },
          { inline_data: { mime_type: mimeType, data: base64 } }
        ]
      }]
    })
  })
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text || text === 'UNKNOWN') throw new Error('Could not identify a product in that photo')
  return text
}