import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { itemName } from '../services/itemName.js'
import { sessionId } from '../services/searchSession.js'
import { fetchPriceHistory, fetchSearchedWith } from '../services/productApi.js'

// A verdict needs a few days of real price history to mean anything.
const MIN_HISTORY_DAYS = 3

export const useCompareStore = defineStore('compare', () => {
  // state
  const result = ref(null)
  const loading = ref(true)
  const failed = ref(false)

  // Map one listing from GET /api/search into the row shape the cards use
  // (name, image, store, price, rating, reviews, freeShipping, onSale, productId).
  function toRow(item, index) {
    return {
      id: String(item.productId || '') + '-' + index,
      productId: item.productId || '',
      name: item.name || '',
      image: item.image || '',
      store: item.store || 'Unknown',
      price: Number(item.price) || 0,
      rating: Number(item.rating) || 0,
      reviews: Number(item.reviews) || 0,
      freeShipping: Boolean(item.freeShipping),
      onSale: item.oldPrice != null
    }
  }

  // Run the search on the server. It reuses a saved copy from the last 6 hours,
  // so a reload costs no SerpApi credit. Returns { name, listings, productKey } built from the
  // first 10 usable results, or null if nothing usable came back.
  async function loadLive(q) {
    try {
      const res = await fetch('/api/search?q=' + encodeURIComponent(q) + '&sid=' + encodeURIComponent(sessionId()))
      if (!res.ok) {
        return null
      }
      const data = await res.json()
      const listings = Array.isArray(data.listings) ? data.listings : []
      const rowsOut = []
      for (let i = 0; i < listings.length && rowsOut.length < 10; i++) {
        const row = toRow(listings[i], i)
        if (row.price > 0) {
          rowsOut.push(row)
        }
      }
      if (!rowsOut.length) {
        return null
      }
      // Record this search in the logged-in user's own history (newest first).
      // Fire-and-forget: axios attaches the Firebase token (src/services/http.js);
      // a logged-out user gets 401, which we ignore so search is never affected.
      axios.post('/api/me/recent-searches', {
        query: data.query || q,
        productKey: data.productKey
      }).catch(function () {})
      return { name: itemName(data.searchTerm || q), listings: rowsOut, productKey: data.productKey || q }
    } catch (err) {
      return null
    }
  }

  async function orEmpty(request) {
    try {
      const data = await request
      return Array.isArray(data) ? data : []
    } catch (err) {
      return []
    }
  }

  // Everything on the page is real: live listings, the tracked price history and what other
  // shoppers searched with this product. A failed search shows the error state, never fake data.
  async function loadResult(q) {
    result.value = null
    failed.value = false
    loading.value = true

    const live = await loadLive(q)
    if (!live) {
      failed.value = true
      loading.value = false
      return
    }
    const history = await orEmpty(fetchPriceHistory(live.productKey))
    const related = await orEmpty(fetchSearchedWith(live.productKey))
    result.value = { name: live.name, listings: live.listings, history: history, related: related.slice(0, 8) }
    loading.value = false
  }

  function showFailed() {
    result.value = null
    failed.value = true
    loading.value = false
  }

  // getters
  const cheapest = computed(function () {
    if (!result.value || !result.value.listings.length) {
      return null
    }
    return result.value.listings.reduce(function (low, row) { return row.price < low ? row.price : low }, Infinity)
  })

  function verdictFor(data) {
    let cheapestNow = data.listings[0].price
    let ratingSum = 0
    let reviewSum = 0
    for (let i = 0; i < data.listings.length; i++) {
      const row = data.listings[i]
      if (row.price < cheapestNow) {
        cheapestNow = row.price
      }
      ratingSum += row.rating
      reviewSum += row.reviews
    }
    let low = data.history[0]
    let sum = 0
    for (let d = 0; d < data.history.length; d++) {
      sum += data.history[d]
      if (data.history[d] < low) {
        low = data.history[d]
      }
    }
    const avg = sum / data.history.length
    const rating = ratingSum / data.listings.length
    let label = 'Maybe'
    let action = 'Wait'
    let why = 'The price is above the recent average. A lower price showed up in the last 14 days.'
    if (cheapestNow <= low * 1.03 && rating >= 4.3) {
      label = 'Worth It'
      action = 'Buy now'
      why = 'The cheapest price is at the low end of the last 14 days, and seller ratings are high.'
    } else if (cheapestNow > avg * 1.08 || rating < 3.9) {
      label = 'Not Worth It'
      action = 'Wait'
      why = 'The cheapest price is above the recent average, or the ratings are weak.'
    } else if (cheapestNow <= avg) {
      label = 'Maybe'
      action = 'Buy now'
      why = 'The price is near the recent average. Ratings are acceptable, but this is not the low.'
    }
    return {
      label: label,
      action: action,
      why: why,
      cheapest: cheapestNow,
      low: low,
      avg: avg,
      rating: rating,
      reviewSum: reviewSum
    }
  }

  // null until enough real price history has been tracked for this product.
  const verdict = computed(function () {
    if (!result.value || !result.value.listings.length || result.value.history.length < MIN_HISTORY_DAYS) {
      return null
    }
    return verdictFor({
      listings: result.value.listings,
      history: result.value.history.map(function (row) { return row.price })
    })
  })

  return { result, loading, failed, verdict, cheapest, loadResult, showFailed }
})
