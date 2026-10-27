<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FdBreadcrumbs from '../components/FdBreadcrumbs.vue'
import FdLoadingSpeed from '../components/FdLoadingSpeed.vue'
import { buildResult, dayLabel, sgd, verdictFor } from '../mock/catalog.js'
import { isSaved, savedFrom, saveProduct, user } from '../mock/session.js'
import { itemName } from '../services/itemName.js'
import { sessionId } from '../services/searchSession.js'
import axios from 'axios'

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
// Image URLs that failed to load, so those cards show the placeholder instead.
const brokenImages = ref({})

// Unique per card. store + price alone collides when one store lists the same
// price twice (it does in live results), so live rows carry SerpAPI's product id.
function rowKey(row) {
  return row.id || row.store + row.price
}

function onImgError(row) {
  brokenImages.value = Object.assign({}, brokenImages.value, { [rowKey(row)]: true })
}

function hasImage(row) {
  return !!row.image && !brokenImages.value[rowKey(row)]
}

// First letter of the store name, for the placeholder tile.
function storeInitial(row) {
  const s = String(row.store || '').trim()
  return s ? s.charAt(0).toUpperCase() : '?'
}

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

// Each card is one product. Save saves that card's product from that card's store.
function rowName(row) {
  return row.name || result.value.name
}

function onSaveFrom(row) {
  if (!user.value) {
    loginNext()
    return
  }
  saveProduct(rowName(row), { store: row.store, price: row.price },
    { productId: row.productId, q: String(route.query.q || ''), image: row.image })
  note.value = 'Saved ' + rowName(row) + ' from ' + row.store + '.'
}

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

// Seed the price-range filter from whatever listings ended up on the result.
function seedPriceRange(listings) {
  if (!listings.length) {
    minPrice.value = 0
    maxPrice.value = 0
    return
  }
  let low = listings[0].price
  let high = listings[0].price
  for (let i = 1; i < listings.length; i++) {
    if (listings[i].price < low) {
      low = listings[i].price
    }
    if (listings[i].price > high) {
      high = listings[i].price
    }
  }
  minPrice.value = low
  maxPrice.value = high
}

// Run the search on the server. It reuses a saved copy from the last 6 hours,
// so a reload costs no SerpApi credit. Returns { name, listings } built from the
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
    return { name: itemName(data.searchTerm || q), listings: rowsOut }
  } catch (err) {
    return null
  }
}

onMounted(async function () {
  const q = String(route.query.q || '').trim()
  if (!q) {
    loading.value = false
    failed.value = true
    return
  }
  if (q.toLowerCase() === 'fail') {
    loading.value = false
    failed.value = true
    return
  }

  // Mock supplies the 14-day price history and related items (SerpAPI returns
  // neither). The product name, the listings table and the verdict all come
  // from the live search when it has usable results; otherwise the whole
  // result falls back to mock so the demo never breaks.
  const built = buildResult(q)
  const live = await loadLive(q)
  if (live) {
    built.name = live.name
    built.listings = live.listings
    // verdict is a computed over result.listings + result.history, so it now
    // reflects the live listings while history/related stay from the mock.
  }
  result.value = built
  seedPriceRange(built.listings)
  loading.value = false
})
</script>

<template>
  <FdLoadingSpeed v-if="loading" message="Comparing prices across stores" />

  <div v-else-if="failed" class="alert alert-danger">
    Could not load listings. Search again from the home page.
  </div>

  <div v-else-if="result">
    <FdBreadcrumbs :items="[{ label: 'FastDeal', to: '/' }, { label: itemName(route.query.q) }]" />
    <p v-if="route.query.from === 'photo'" class="small text-secondary mb-1">Identified from your photo</p>
    <h1 class="fd-page-title">{{ result.name }}</h1>
    <p class="fd-page-subtitle">{{ result.listings.length }} listings. Cheapest now is {{ sgd(verdict.cheapest) }}.</p>

    <div class="card verdict p-3 mb-3" :class="verdict.label === 'Worth It' ? 'worth' : verdict.label === 'Not Worth It' ? 'not' : 'maybe'">
      <p class="mb-1"><strong>{{ verdict.label }}</strong> · {{ verdict.action }}</p>
      <p class="mb-1">{{ verdict.why }}</p>
      <p class="small text-secondary mb-0">14-day low {{ sgd(verdict.low) }}. 14-day average {{ sgd(verdict.avg) }}. Mean rating {{ verdict.rating.toFixed(1) }} from {{ verdict.reviewSum }} reviews.</p>
    </div>

    <p v-if="note" class="small mb-3" role="status">{{ note }}</p>

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

    <ul v-else class="fd-card-grid" role="list">
      <li v-for="row in rows" :key="rowKey(row)">
        <article class="fd-listing-card" :class="{ cheapest: row.price === lowInView }">
          <div class="fd-listing-media">
            <img
              v-if="hasImage(row)"
              :src="row.image"
              :alt="row.name || result.name"
              class="fd-listing-img"
              loading="lazy"
              @error="onImgError(row)"
            />
            <div v-else class="fd-listing-ph" aria-hidden="true">{{ storeInitial(row) }}</div>
            <span v-if="row.price === lowInView" class="badge text-bg-success fd-listing-badge">
              Cheapest
            </span>
          </div>

          <div class="fd-listing-body">
            <h3 class="fd-listing-name" :title="row.name || result.name">
              <!-- stretched-link makes the whole card open the product page -->
              <router-link v-if="row.productId" class="fd-listing-link stretched-link"
                :to="{ path: '/product/' + row.productId, query: { q: route.query.q, store: row.store } }">{{ row.name || result.name }}</router-link>
              <template v-else>{{ row.name || result.name }}</template>
            </h3>
            <p class="fd-listing-price">
              {{ sgd(row.price) }}
              <span v-if="row.price === lowInView" class="visually-hidden">(cheapest listing)</span>
            </p>
            <p class="fd-listing-store">{{ row.store }}</p>
            <p class="fd-listing-meta">
              <span :aria-label="'Rating ' + row.rating.toFixed(1) + ' out of 5'">★ {{ row.rating.toFixed(1) }}</span>
              <span aria-hidden="true"> · </span>
              <span>{{ row.reviews }} reviews</span>
            </p>
          </div>

          <button
            class="btn btn-sm btn-outline-dark fd-listing-save"
            type="button"
            :disabled="savedFrom(rowName(row), row.productId) === row.store"
            @click="onSaveFrom(row)"
          >{{ savedFrom(rowName(row), row.productId) === row.store ? 'Saved' : isSaved(rowName(row), row.productId) ? 'Save from here instead' : 'Save from here' }}</button>
        </article>
      </li>
    </ul>

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

<style scoped>
/* Listings as a responsive card grid: 4 per row on wide screens, down to 1 on phones. */
.fd-card-grid {
  display: grid;
  gap: 1rem;
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
  grid-template-columns: 1fr;
}

@media (min-width: 576px) {
  .fd-card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 768px) {
  .fd-card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1200px) {
  .fd-card-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.fd-listing-card {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0.75rem;
  border: var(--fd-border, 1px) solid var(--fd-vanilla-line, #e4ddcf);
  border-radius: 1rem;
  background: var(--fd-paper, #fff);
  color: var(--fd-text, #1a1a1a);
}

/* The cheapest listing is highlighted, mirroring the old table row. */
.fd-listing-card.cheapest {
  border-color: var(--fd-green, #2f6b47);
  box-shadow: 0 0 0 2px var(--fd-green, #2f6b47);
}

.fd-listing-media {
  position: relative;
  margin-bottom: 0.75rem;
}

.fd-listing-img,
.fd-listing-ph {
  display: block;
  width: 100%;
  height: 150px;
  border-radius: 0.75rem;
  /* White behind every product photo, like the photos' own backgrounds. */
  background: var(--fd-white);
}

/* The whole photo always shows, with a little white space around it. */
.fd-listing-img {
  padding: 0.75rem;
  object-fit: contain;
}

/* Placeholder tile when a listing has no image or it fails to load. */
.fd-listing-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fd-text-muted, #6b6b6b);
  font-family: var(--fd-font-display, inherit);
  font-size: var(--fd-page-title);
}

.fd-listing-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
}

.fd-listing-body {
  flex: 1;
}

.fd-listing-name {
  margin: 0 0 0.25rem;
  font-size: var(--fd-body, 1rem);
  font-weight: 600;
  line-height: 1.3;
  /* Clamp long titles to two lines so cards stay even height. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fd-listing-price {
  margin: 0 0 0.125rem;
  color: var(--fd-blue, #1f4fd8);
  font-family: var(--fd-font-display, inherit);
  font-size: var(--fd-section-title);
  line-height: 1.1;
}

.fd-listing-store {
  margin: 0 0 0.125rem;
  color: var(--fd-text, #1a1a1a);
  font-size: var(--fd-small, 0.875rem);
}

.fd-listing-meta {
  margin: 0;
  color: var(--fd-text-muted, #6b6b6b);
  font-size: var(--fd-small, 0.875rem);
}

.fd-listing-save {
  position: relative;
  z-index: 2;
  margin-top: 0.75rem;
  width: 100%;
}

/* The title link opens the product page. It keeps the card's text colour. */
.fd-listing-link {
  color: inherit;
  text-decoration: none;
}

.fd-listing-link:hover,
.fd-listing-link:focus-visible {
  text-decoration: underline;
}
</style>
