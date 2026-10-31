import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { itemName } from '../services/itemName.js'
import { sessionId } from '../services/searchSession.js'
import { fetchSearchedWith } from '../services/productApi.js'

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

  // Everything on the page is real: live listings and what other shoppers searched with this product. A failed search shows the error state, never fake data.
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
    const related = await orEmpty(fetchSearchedWith(live.productKey))
    result.value = { name: live.name, listings: live.listings, related: related.slice(0, 8) }
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

  return { result, loading, failed, cheapest, loadResult, showFailed }
})
