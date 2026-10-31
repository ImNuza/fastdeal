import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchProduct, fetchSearchedWith } from '../services/productApi.js'
import { useErrorStore } from './error.js'

export const useProductStore = defineStore('product', () => {
  // state
  const product = ref(null)
  const loading = ref(true)
  const errorText = ref('')
  const searchedWith = ref([])

  // getters: stores come back cheapest total first
  const cheapest = computed(function () {
    return product.value && product.value.stores.length ? product.value.stores[0] : null
  })

  const highest = computed(function () {
    const stores = product.value ? product.value.stores : []
    return stores.length > 1 ? stores[stores.length - 1] : null
  })

  const ratingTotal = computed(function () {
    return (product.value ? product.value.ratings : []).reduce(function (sum, row) {
      return sum + row.amount
    }, 0)
  })

  function percentOf(amount) {
    return ratingTotal.value ? Math.round((amount / ratingTotal.value) * 100) : 0
  }

  // actions
  async function loadProduct(productId, q) {
    // Clear the last product so a new visit never shows the old one.
    product.value = null
    searchedWith.value = []
    errorText.value = ''
    loading.value = true
    try {
      product.value = await fetchProduct(productId, q)
    } catch (error) {
      // fetch() skips the axios error check in http.js, so a missing product or a down server
      // shows the error page here. No status means the request never reached the server.
      if (error.status === 404) {
        useErrorStore().showError(404, 'This product could not be found. It may have been removed.')
      } else if (!error.status || error.status >= 500) {
        useErrorStore().showError(navigator.onLine ? error.status || 503 : 'offline')
      } else {
        errorText.value = error.message
      }
    } finally {
      loading.value = false
    }
    if (product.value) {
      searchedWith.value = await fetchSearchedWith(product.value.q || q)
    }
  }

  return { product, loading, errorText, searchedWith, cheapest, highest, ratingTotal, percentOf, loadProduct }
})
