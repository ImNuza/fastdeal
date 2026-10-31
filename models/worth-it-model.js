// Server-side (Node/Express) "Worth It" verdict model for FastDeal.
// Flow: ProductView -> GET /api/worth-it?productId=&q= -> server.js loads the product (cached),
// its tracked price history and the next big sale -> worthIt(product, history, sale) -> Gemini.
// Gemini reads the rows from services/worthItInputs.js (live store prices, the sale calendar, and
// price history when there is enough), and returns buy now or wait. The answer, the rows and the
// exact prompt go back together, so the "How this verdict was made" page can show what the AI read.
//
// Conventions match models/shoppingapimodel.js:
//   - GEMINI_API_KEY is read at module scope (server.js does `import 'dotenv/config'`
//     BEFORE importing this model, so process.env is already populated).
//   - Raw REST fetch to generativelanguage.googleapis.com, body { contents:[{parts:[{text}]}] }.
//   - Any failure returns a graceful FALLBACK verdict; worthIt() never throws upward,
//     so the product page always renders.
//
// Model: WORTH_IT_MODEL is the primary. When it is busy or down (429 quota, or a 5xx such as
// 503 "high demand"), it retries ONCE with WORTH_IT_FALLBACK_MODEL. When both fail, the answer
// comes from fixed rules on the same numbers (ruleVerdict), marked source 'rules'.
// A Gemini verdict is saved in worthItCache for the rest of the Singapore day. A rules verdict is
// saved for RULES_MINUTES only, so the page asks Gemini again soon, but not on every view.

import WorthItCache from './worth-it-cache-model.js'
import { verdictInputs, verdictPrompt, ruleVerdict } from '../services/worthItInputs.js'
import { sgDay } from '../services/priceHistory.js'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// Primary model, then the backup when the primary is busy or down.
// 3.5-flash-lite answered in about 1s every time in a check on 31 Oct. 3.1 took up to 7s and was
// sometimes overloaded (503), so it is the backup now.
const WORTH_IT_MODEL = 'gemini-3.5-flash-lite'
const WORTH_IT_FALLBACK_MODEL = 'gemini-3.1-flash-lite'
const RULES_MINUTES = 10

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

// Call one Gemini model once. Returns { ok, status, errorStatus, text }:
//   ok=true with text on success; ok=false with status (HTTP) and errorStatus
//   (the Google error .status string, e.g. "RESOURCE_EXHAUSTED") on failure.
async function callGemini(model, prompt) {
  try {
    const res = await fetch(`${geminiUrl(model)}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Ask for JSON in a fixed shape, so fewer answers come back unusable.
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              decision: { type: 'STRING', enum: ['buy', 'wait'] },
              headline: { type: 'STRING' },
              reason: { type: 'STRING' }
            },
            required: ['decision', 'headline', 'reason']
          }
        }
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

const DAY = 24 * 3600000

// Public entry point. product: from getProduct. history: [{ day, price }] tracked by FastDeal.
// sale: the next big sale ({ name, day, daysAway }) or null.
// Always resolves to a verdict object with inputs, summary and prompt; never throws.
export async function worthIt(product, history, sale) {
  if (!product || !product.title) return fallbackVerdict('No product was given.')
  const { rows, summary } = verdictInputs(product, history, sale)
  const cheapest = (product.stores || []).filter(function (row) { return row.total > 0 })
    .reduce(function (low, row) { return !low || row.total < low.total ? row : low }, null)
  if (!cheapest) return fallbackVerdict('No store price was found for this product.')

  const prompt = verdictPrompt(rows)
  const extra = {
    inputs: rows,
    summary: summary,
    prompt: prompt,
    price: cheapest.total,
    product: { productId: product.productId, q: product.q || '', title: product.title, image: product.image || '' }
  }

  const key = product.productId + '|' + cheapest.total.toFixed(2) + '|' + sgDay(Date.now())
  try {
    const saved = await WorthItCache.findOne({ key: key, expiresAt: { $gt: new Date() } }).lean()
    if (saved) return Object.assign({}, saved.verdict, { cached: true })
  } catch (error) {
    console.error('[Worth it] cache read failed:', error.message)
  }

  if (!GEMINI_API_KEY) {
    return Object.assign(ruleVerdict(product, sale) || fallbackVerdict('AI verdict is not configured.'), extra)
  }

  // Primary model, then the backup once when the primary is busy (429) or down (5xx, or no answer).
  let call = await callGemini(WORTH_IT_MODEL, prompt)
  let model = WORTH_IT_MODEL
  if (!call.ok && (call.status === 429 || call.status >= 500 || call.status === 0)) {
    call = await callGemini(WORTH_IT_FALLBACK_MODEL, prompt)
    model = WORTH_IT_FALLBACK_MODEL
  }

  const answer = call.ok ? toVerdict(call.text, model) : null
  if (!answer) {
    // Both models failed or gave nothing usable: answer with the rules, and keep it a short while.
    const rules = ruleVerdict(product, sale)
    if (!rules) {
      return Object.assign(fallbackVerdict('We could not get an AI verdict right now. Use the deal check below.'), extra)
    }
    const estimate = Object.assign(rules, extra, { madeAt: new Date().toISOString() })
    await saveVerdict(key, estimate, RULES_MINUTES * 60000)
    return estimate
  }

  const verdict = Object.assign(answer, extra, { madeAt: new Date().toISOString() })
  await saveVerdict(key, verdict, DAY)
  return verdict
}

async function saveVerdict(key, verdict, ms) {
  try {
    await WorthItCache.updateOne(
      { key: key },
      { $set: { verdict: verdict, expiresAt: new Date(Date.now() + ms) } },
      { upsert: true }
    )
  } catch (error) {
    console.error('[Worth it] cache write failed:', error.message)
  }
}
