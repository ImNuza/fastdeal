<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { buildResult, dayLabel, sgd, verdictFor } from '../mock/catalog.js'
import { isAsleep, isSaved, savedFrom, saveProduct, sleepOn, user } from '../mock/session.js'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const failed = ref(false)
const result = ref(null)
const minPrice = ref(0)
const maxPrice = ref(0)
const storeName = ref('All')
const minRating = ref(0)
const freeOnly = ref(false)
const saleOnly = ref(false)
const sortBy = ref('price')
const note = ref('')

const verdict = computed(function () {
  if (!result.value) {
    return null
  }
  return verdictFor(result.value)
})

const stores = computed(function () {
  if (!result.value) {
    return []
  }
  const names = []
  for (let i = 0; i < result.value.listings.length; i++) {
    const name = result.value.listings[i].store
    if (names.indexOf(name) === -1) {
      names.push(name)
    }
  }
  return names
})

const rows = computed(function () {
  if (!result.value) {
    return []
  }
  const next = []
  for (let i = 0; i < result.value.listings.length; i++) {
    const row = result.value.listings[i]
    if (row.price < Number(minPrice.value) || row.price > Number(maxPrice.value)) {
      continue
    }
    if (storeName.value !== 'All' && row.store !== storeName.value) {
      continue
    }
    if (Number(minRating.value) && row.rating < Number(minRating.value)) {
      continue
    }
    if (freeOnly.value && !row.freeShipping) {
      continue
    }
    if (saleOnly.value && !row.onSale) {
      continue
    }
    next.push(row)
  }
  next.sort(function (a, b) {
    if (sortBy.value === 'rating') {
      return b.rating - a.rating
    }
    if (sortBy.value === 'reviews') {
      return b.reviews - a.reviews
    }
    return a.price - b.price
  })
  return next
})

const lowInView = computed(function () {
  if (!rows.value.length) {
    return null
  }
  let low = rows.value[0].price
  for (let i = 1; i < rows.value.length; i++) {
    if (rows.value[i].price < low) {
      low = rows.value[i].price
    }
  }
  return low
})

const historyMax = computed(function () {
  if (!result.value) {
    return 1
  }
  let high = result.value.history[0]
  for (let i = 1; i < result.value.history.length; i++) {
    if (result.value.history[i] > high) {
      high = result.value.history[i]
    }
  }
  return high
})

function loginNext() {
  router.push({ path: '/login', query: { next: route.fullPath } })
}

function onSave() {
  if (!user.value) {
    loginNext()
    return
  }
  saveProduct(result.value.name)
  note.value = 'Saved to wishlist from ' + savedFrom(result.value.name) + '.'
}

// Save from one specific store row in the listings table.
function onSaveFrom(row) {
  if (!user.value) {
    loginNext()
    return
  }
  saveProduct(result.value.name, { store: row.store, price: row.price })
  note.value = 'Saved to wishlist from ' + row.store + '.'
}

function onSleep() {
  if (!user.value) {
    loginNext()
    return
  }
  // Already on hold: leave its timer alone.
  if (isAsleep(result.value.name)) {
    return
  }
  sleepOn(result.value.name, 24)
  note.value = 'Saved to wishlist and on hold for 1 day.'
}

onMounted(function () {
  const q = String(route.query.q || '').trim()
  if (!q) {
    loading.value = false
    failed.value = true
    return
  }
  if (q.toLowerCase() === 'fail') {
    setTimeout(function () {
      loading.value = false
      failed.value = true
    }, 700)
    return
  }
  setTimeout(function () {
    const built = buildResult(q)
    result.value = built
    let low = built.listings[0].price
    let high = built.listings[0].price
    for (let i = 1; i < built.listings.length; i++) {
      if (built.listings[i].price < low) {
        low = built.listings[i].price
      }
      if (built.listings[i].price > high) {
        high = built.listings[i].price
      }
    }
    minPrice.value = low
    maxPrice.value = high
    loading.value = false
  }, 700)
})
</script>

<template>
  <p v-if="loading" class="text-secondary">Loading listings...</p>

  <div v-else-if="failed" class="alert alert-danger">
    Could not load listings. Search again from the home page.
  </div>

  <div v-else-if="result">
    <p v-if="route.query.from === 'photo'" class="small text-secondary mb-1">Identified from your photo</p>
    <h1 class="fd-page-title">{{ result.name }}</h1>
    <p class="fd-page-subtitle">{{ result.listings.length }} listings. Cheapest now is {{ sgd(verdict.cheapest) }}.</p>

    <div class="card verdict p-3 mb-3" :class="verdict.label === 'Worth It' ? 'worth' : verdict.label === 'Not Worth It' ? 'not' : 'maybe'">
      <p class="mb-1"><strong>{{ verdict.label }}</strong> · {{ verdict.action }}</p>
      <p class="mb-1">{{ verdict.why }}</p>
      <p class="small text-secondary mb-0">14-day low {{ sgd(verdict.low) }}. 14-day average {{ sgd(verdict.avg) }}. Mean rating {{ verdict.rating.toFixed(1) }} from {{ verdict.reviewSum }} reviews.</p>
    </div>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <button class="btn btn-dark" type="button" @click="onSave">{{ isSaved(result.name) ? 'Saved' : 'Save' }}</button>
      <button class="btn btn-outline-dark" type="button" @click="onSleep">{{ isAsleep(result.name) ? 'On hold' : 'Sleep on it' }}</button>
      <span v-if="note" class="align-self-center small">{{ note }}</span>
      <span v-if="!user" class="align-self-center small text-secondary">Log in to save or hold this product.</span>
    </div>

    <div class="card p-3 mb-3">
      <div class="row g-2">
        <div class="col-6 col-md-2">
          <label class="form-label small" for="min">Min price</label>
          <input id="min" v-model.number="minPrice" class="form-control form-control-sm" type="number" />
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label small" for="max">Max price</label>
          <input id="max" v-model.number="maxPrice" class="form-control form-control-sm" type="number" />
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label small" for="store">Store</label>
          <select id="store" v-model="storeName" class="form-select form-select-sm">
            <option>All</option>
            <option v-for="name in stores" :key="name">{{ name }}</option>
          </select>
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label small" for="rating">Min rating</label>
          <select id="rating" v-model.number="minRating" class="form-select form-select-sm">
            <option :value="0">Any</option>
            <option :value="4">4.0+</option>
            <option :value="4.5">4.5+</option>
          </select>
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label small" for="sort">Sort</label>
          <select id="sort" v-model="sortBy" class="form-select form-select-sm">
            <option value="price">Lowest price</option>
            <option value="rating">Highest rating</option>
            <option value="reviews">Most reviews</option>
          </select>
        </div>
        <div class="col-6 col-md-2 d-flex flex-column justify-content-end">
          <div class="form-check">
            <input id="ship" v-model="freeOnly" class="form-check-input" type="checkbox" />
            <label class="form-check-label small" for="ship">Free shipping</label>
          </div>
          <div class="form-check">
            <input id="sale" v-model="saleOnly" class="form-check-input" type="checkbox" />
            <label class="form-check-label small" for="sale">On sale</label>
          </div>
        </div>
      </div>
    </div>

    <p v-if="!rows.length" class="alert alert-warning">No listings match these filters.</p>

    <div v-else class="table-responsive mb-4">
      <table class="table table-bordered align-middle">
        <thead>
          <tr>
            <th>Price</th>
            <th>Store</th>
            <th>Rating</th>
            <th>Reviews</th>
            <th>Shipping</th>
            <th>Sale</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.store + row.price" :class="{ cheapest: row.price === lowInView }">
            <td>
              {{ sgd(row.price) }}
              <span v-if="row.price === lowInView" class="badge text-bg-success ms-1">Cheapest</span>
            </td>
            <td>{{ row.store }}</td>
            <td>{{ row.rating.toFixed(1) }}</td>
            <td>{{ row.reviews }}</td>
            <td>{{ row.freeShipping ? 'Free' : 'Paid' }}</td>
            <td>{{ row.onSale ? 'Yes' : 'No' }}</td>
            <td>
              <button
                class="btn btn-sm btn-outline-dark"
                type="button"
                :disabled="savedFrom(result.name) === row.store"
                @click="onSaveFrom(row)"
              >{{ savedFrom(result.name) === row.store ? 'Saved' : isSaved(result.name) ? 'Save from here instead' : 'Save from here' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2 class="fd-section-title">Price history</h2>
    <p class="small text-secondary">Last 14 days. Taller bar means a higher price.</p>
    <div class="history mb-2">
      <span
        v-for="(price, index) in result.history"
        :key="index"
        :style="{ height: Math.round((price / historyMax) * 84) + 'px' }"
        :title="dayLabel(result.history.length - 1 - index) + ' ' + sgd(price)"
      ></span>
    </div>
    <p class="small text-secondary">{{ dayLabel(13) }} to {{ dayLabel(0) }}. Low {{ sgd(verdict.low) }}.</p>

    <h2 class="fd-section-title mt-4">Searched with this</h2>
    <div class="d-flex flex-wrap gap-2">
      <router-link
        v-for="name in result.related"
        :key="name"
        class="btn btn-outline-dark btn-sm"
        :to="{ path: '/compare', query: { q: name } }"
      >{{ name }}</router-link>
    </div>
  </div>
</template>
