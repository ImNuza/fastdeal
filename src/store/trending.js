import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

// What people searched on FastDeal, from /api/trending: { query, image, count } per product.
export const useTrendingStore = defineStore('trending', () => {
  const today = ref([])
  const week = ref([])
  const loaded = ref(false)
  const error = ref('')
  let pending = null

  // Home page: the top 5 for today, and up to 8 more from the week that are not already in those 5.
  const topToday = computed(function () {
    return today.value.slice(0, 5)
  })

  const weekExtras = computed(function () {
    const shown = topToday.value.map(function (item) { return item._id })
    return week.value.filter(function (item) { return !shown.includes(item._id) }).slice(0, 8)
  })

  async function fetchTrending() {
    error.value = ''
    try {
      const res = await axios.get('/api/trending')
      today.value = res.data.today
      week.value = res.data.week
      loaded.value = true
    } catch (err) {
      error.value = 'Could not load trending.'
    }
  }

  // Loads once; the search bar calls this on every page.
  function ensureTrending() {
    if (loaded.value) return Promise.resolve()
    if (!pending) {
      pending = fetchTrending().finally(function () { pending = null })
    }
    return pending
  }

  return { today, week, loaded, error, topToday, weekExtras, fetchTrending, ensureTrending }
})
