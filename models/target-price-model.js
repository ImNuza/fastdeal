// AI target price for a newly saved wishlist product, from its 30-day price history.
// Only products with history get one (the caller checks); everything else keeps the 90% rule.
// Gemini returns { targetPrice, reason }. A number that is not a sensible target (not below the
// saved price, or far under anything the product has sold for) is thrown away, so a bad answer
// never becomes someone's alert. Never throws: any failure gives null.
import { geminiFetch, hasGeminiKey } from '../services/geminiKeys.js'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const TARGET_MODEL = 'gemini-3.5-flash-lite'
// Saving waits for this, so a slow answer falls back to the 90% rule instead.
const TIMEOUT_MS = 5000
// The lowest target accepted, as a share of the 30-day low.
const FLOOR_OF_LOW = 0.85

// A clean target price, or null. value: Gemini's number. history: summarizeHistory's result.
export function cleanTarget(value, savedPrice, history) {
  const price = Number(value)
  if (!Number.isFinite(price) || price <= 0) return null
  if (!(savedPrice > 0) || price >= savedPrice) return null
  if (history && history.low > 0 && price < history.low * FLOOR_OF_LOW) return null
  return Math.round(price * 100) / 100
}

function buildPrompt(name, savedPrice, store, history, sale) {
  const lines = [
    'You set a price alert for a shopper in Singapore. Suggest ONE target price in SGD: a price',
    'that is realistic to see again soon, so the alert is worth waiting for but will actually fire.',
    'It must be below the price they saved at. Use the 30-day history; do not go far below its low.',
    '',
    'Product: ' + name,
    'Saved at: S$' + savedPrice + (store ? ' (' + store + ')' : ''),
    '30-day history (lowest store price each day, ' + history.days + ' days):',
    '  low S$' + history.low + ' on ' + history.lowDay + ', high S$' + history.high +
      ', average S$' + history.average + ', latest S$' + history.last +
      ', change over the last week ' + history.weekChange + '%'
  ]
  if (sale) {
    lines.push('Next big sale: ' + sale.name + ', ' + sale.daysAway + ' days away.')
  }
  lines.push('', 'Reply with the target price and one short sentence (under 20 words) on why.')
  return lines.join('\n')
}

// { price, reason } or null.
export async function suggestTarget({ name, savedPrice, store, history, sale }) {
  if (!history || !hasGeminiKey()) return null
  const controller = new AbortController()
  const timer = setTimeout(function () { controller.abort() }, TIMEOUT_MS)
  try {
    const res = await geminiFetch(GEMINI_BASE, TARGET_MODEL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(name, savedPrice, store, history, sale) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              targetPrice: { type: 'NUMBER' },
              reason: { type: 'STRING' }
            },
            required: ['targetPrice', 'reason']
          }
        }
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text
    const parsed = JSON.parse(text || 'null')
    const price = cleanTarget(parsed && parsed.targetPrice, savedPrice, history)
    if (price === null) return null
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim().slice(0, 200) : ''
    return { price: price, reason: reason }
  } catch (error) {
    return null
  } finally {
    clearTimeout(timer)
  }
}
