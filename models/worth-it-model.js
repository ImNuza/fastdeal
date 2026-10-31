// Server-side (Node/Express) "Worth It" verdict model for FastDeal.
// Flow: ProductView -> GET /api/worth-it?name=&price= -> worthIt(name, price) -> Gemini.
// Given a product name and a price, ask Gemini whether to buy now or wait for a big
// sale, and return a small verdict object the product page renders above the Deal check.
//
// Conventions match models/shoppingapimodel.js:
//   - GEMINI_API_KEY is read at module scope (server.js does `import 'dotenv/config'`
//     BEFORE importing this model, so process.env is already populated).
//   - Raw REST fetch to generativelanguage.googleapis.com, body { contents:[{parts:[{text}]}] }.
//   - Any failure returns a graceful FALLBACK verdict; worthIt() never throws upward,
//     so the product page always renders.
//
// Model: gemini-3.8-flash is the primary. On a 429 RESOURCE_EXHAUSTED (quota/rate limit)
// it retries ONCE with gemini-3.6-flash. Any other error falls back to a neutral verdict.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// Primary model, then the backup used only on a 429 RESOURCE_EXHAUSTED.
const WORTH_IT_MODEL = 'gemini-3.1-flash-lite'
const WORTH_IT_FALLBACK_MODEL = 'gemini-3.5-flash-lite'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

function geminiUrl(model) {
  return `${GEMINI_BASE}/${model}:generateContent`
}

// The neutral verdict shown whenever Gemini is unavailable or returns nothing usable.
// decision is one of: 'buy' | 'wait' | 'unknown'. The page renders reason + a tone colour.
function fallbackVerdict(reason) {
  return {
    decision: 'unknown',
    headline: 'No verdict available',
    reason: reason || 'We could not get an AI verdict right now. Use the deal check below.',
    source: 'fallback'
  }
}

// Extract the first {...} JSON object from Gemini's text, tolerating ```json fences
// and stray prose around it. Returns the parsed object, or null on any failure.
// (Same approach as parseGeminiJson in shoppingapimodel.js.)
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

// Build the exact prompt sent to Gemini.
function buildPrompt(name, price) {
  return (
    `You are a shopping adviser for Singapore shoppers. ` +
    `A shopper is looking at this product:\n` +
    `Product: ${name}\n` +
    `Current price: S$${price}\n\n` +
    `Decide whether they should BUY NOW at this price, or WAIT for a big sale ` +
    `(for example 11.11, Black Friday, 12.12, or a mid-year sale) where it is ` +
    `likely to be cheaper. Consider how often this kind of product is discounted, ` +
    `how close the next major sale is, and whether S$${price} is already a good price.\n\n` +
    `Return JSON only, no prose, in exactly this shape:\n` +
    `{"decision": "buy" | "wait", "headline": string (max 6 words), ` +
    `"reason": string (one short sentence, max 25 words)}`
  )
}

// Call one Gemini model once. Returns { ok, status, errorStatus, text }:
//   ok=true with text on success; ok=false with status (HTTP) and errorStatus
//   (the Google error .status string, e.g. "RESOURCE_EXHAUSTED") on failure.
async function callGemini(model, prompt) {
  try {
    const res = await fetch(`${geminiUrl(model)}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    })

    if (!res.ok) {
      // Read the Google error payload to detect RESOURCE_EXHAUSTED on a 429.
      const errBody = await res.json().catch(function () {
        return null
      })
      const errorStatus = errBody && errBody.error && errBody.error.status
      return { ok: false, status: res.status, errorStatus: errorStatus || '', text: '' }
    }

    const data = await res.json()
    const text = data && data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text
    return { ok: true, status: 200, errorStatus: '', text: text || '' }
  } catch (error) {
    return { ok: false, status: 0, errorStatus: '', text: '' }
  }
}

// Turn Gemini's text into a clean verdict object, or null if it is not usable.
function toVerdict(text, model) {
  const parsed = parseGeminiJson(text)
  if (!parsed) return null

  const decision = parsed.decision === 'buy' || parsed.decision === 'wait' ? parsed.decision : null
  if (!decision) return null

  const headline = typeof parsed.headline === 'string' && parsed.headline.trim()
    ? parsed.headline.trim()
    : decision === 'buy' ? 'Buy now' : 'Wait for a sale'
  const reason = typeof parsed.reason === 'string' && parsed.reason.trim()
    ? parsed.reason.trim()
    : ''

  return { decision, headline, reason, source: model }
}

// Public entry point. name: product title, price: current (cheapest) price shown.
// Always resolves to a verdict object; never throws.
export async function worthIt(name, price) {
  const cleanName = String(name || '').trim()
  const cleanPrice = Number(price)
  if (!cleanName) return fallbackVerdict('No product name was given.')
  if (!Number.isFinite(cleanPrice) || cleanPrice <= 0) {
    return fallbackVerdict('No valid price was given.')
  }
  if (!GEMINI_API_KEY) return fallbackVerdict('AI verdict is not configured.')

  const prompt = buildPrompt(cleanName, cleanPrice.toFixed(2))

  // Primary model.
  let call = await callGemini(WORTH_IT_MODEL, prompt)

  // Backup ONLY on a 429 RESOURCE_EXHAUSTED (quota / rate limit).
  if (!call.ok && call.status === 429 && call.errorStatus === 'RESOURCE_EXHAUSTED') {
    call = await callGemini(WORTH_IT_FALLBACK_MODEL, prompt)
    if (call.ok) {
      const verdict = toVerdict(call.text, WORTH_IT_FALLBACK_MODEL)
      if (verdict) return verdict
    }
    return fallbackVerdict('The AI verdict service is busy right now. Try again later.')
  }

  if (!call.ok) {
    return fallbackVerdict('We could not get an AI verdict right now. Use the deal check below.')
  }

  const verdict = toVerdict(call.text, WORTH_IT_MODEL)
  return verdict || fallbackVerdict('The AI verdict was unclear. Use the deal check below.')
}
