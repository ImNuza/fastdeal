// AI suggested target price for a newly saved wishlist product, from its 30-day price history and
// the store listings for it today. Either one is enough; with neither there is no suggestion.
// The suggestion is only the grey hint in the Wishlist's target box: it never sets an alert.
// Gemini returns { targetPrice, reason }. A number that is not a sensible target (not below the
// saved price, or far under anything the product has sold or is listed for) is thrown away.
// Never throws: any failure gives null.
import { geminiFetch, hasGeminiKey } from '../services/geminiKeys.js'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const TARGET_MODEL = 'gemini-3.5-flash-lite'
// Saving waits for this, so a slow answer just leaves no suggestion.
const TIMEOUT_MS = 5000
// The lowest target accepted, as a share of the lowest price seen (30-day low or cheapest listing).
const FLOOR_OF_LOW = 0.85

// The listings in short: { count, low, lowStore, high, typical } from rows of { store, total },
// or null with no priced rows. typical is the middle total.
export function summarizeListings(rows) {
  const priced = (rows || []).filter(function (row) { return row && row.total > 0 })
    .sort(function (a, b) { return a.total - b.total })
  if (!priced.length) return null
  const mid = Math.floor(priced.length / 2)
  const typical = priced.length % 2 ? priced[mid].total : (priced[mid - 1].total + priced[mid].total) / 2
  return {
    count: priced.length,
    low: priced[0].total,
    lowStore: priced[0].store || '',
    high: priced[priced.length - 1].total,
    typical: Math.round(typical * 100) / 100
  }
}

// A clean target price, or null. value: Gemini's number. history: summarizeHistory's result.
// listings: summarizeListings' result.
export function cleanTarget(value, savedPrice, history, listings) {
  const price = Number(value)
  if (!Number.isFinite(price) || price <= 0) return null
  if (!(savedPrice > 0) || price >= savedPrice) return null
  if (history && history.low > 0 && price < history.low * FLOOR_OF_LOW) return null
  if (listings && listings.low > 0 && price < listings.low * FLOOR_OF_LOW) return null
  return Math.round(price * 100) / 100
}

function buildPrompt(name, savedPrice, store, history, listings, sale) {
  const lines = [
    'You set a price alert for a shopper in Singapore. Suggest ONE target price in SGD: a price',
    'that is realistic to see again soon, so the alert is worth waiting for but will actually fire.',
    'It must be below the price they saved at. Do not go far below the lowest price in the facts.',
    '',
    'Product: ' + name,
    'Saved at: S$' + savedPrice + (store ? ' (' + store + ')' : '')
  ]
  if (history) {
    lines.push('30-day history (lowest store price each day, ' + history.days + ' days):',
      '  low S$' + history.low + ' on ' + history.lowDay + ', high S$' + history.high +
        ', average S$' + history.average + ', latest S$' + history.last +
        ', change over the last week ' + history.weekChange + '%')
  }
  if (listings) {
    lines.push('Store listings today (' + listings.count + '):',
      '  cheapest S$' + listings.low + (listings.lowStore ? ' at ' + listings.lowStore : '') +
        ', typical S$' + listings.typical + ', highest S$' + listings.high)
  }
  if (sale) {
    lines.push('Next big sale: ' + sale.name + ', ' + sale.daysAway + ' days away.')
  }
  lines.push('', 'Reply with the target price and one short sentence (under 20 words) on why.')
  return lines.join('\n')
}

// { price, reason } or null.
export async function suggestTarget({ name, savedPrice, store, history, listings, sale }) {
  if ((!history && !listings) || !hasGeminiKey()) return null
  const controller = new AbortController()
  const timer = setTimeout(function () { controller.abort() }, TIMEOUT_MS)
  try {
    const res = await geminiFetch(GEMINI_BASE, TARGET_MODEL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(name, savedPrice, store, history, listings, sale) }] }],
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
    const price = cleanTarget(parsed && parsed.targetPrice, savedPrice, history, listings)
    if (price === null) return null
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim().slice(0, 200) : ''
    return { price: price, reason: reason }
  } catch (error) {
    return null
  } finally {
    clearTimeout(timer)
  }
}
