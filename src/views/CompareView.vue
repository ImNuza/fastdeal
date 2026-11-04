<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FdBreadcrumbs from '../components/FdBreadcrumbs.vue'
import FdLoadingSpeed from '../components/FdLoadingSpeed.vue'
import { sgd } from '../services/format.js'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../store/auth.js'
import { useWishlistStore } from '../store/wishlist.js'
import { itemName } from '../services/itemName.js'
import { sessionId } from '../services/searchSession.js'
import { fetchSearchedWith } from '../services/productApi.js'
import { useCompareStore } from '../store/compare.js'
import axios from 'axios'
import FdPager from '../components/FdPager.vue'
import FdIcon from '../components/FdIcon.vue'
import FdPriceChart from '../components/FdPriceChart.vue'
import { useListPages } from '../services/listPages.js'
import FdBelt from '../components/FdBelt.vue'

const route = useRoute()
const { user } = storeToRefs(useAuthStore())
const { isSaved, savedFrom, saveProduct } = useWishlistStore()
const router = useRouter()

// The search results live in the compare store. "Customers who viewed this also viewed" is loaded below.
const compareStore = useCompareStore()
const { result, loading, failed, cheapest } = storeToRefs(compareStore)
const { loadResult, showFailed } = compareStore

// The price boxes start empty; an empty box does not filter.
const minPrice = ref('')
const maxPrice = ref('')
const storeName = ref('All')
const minRating = ref(0)
const sortBy = ref('price')
const note = ref('')

// Phones: the filters fold into a button, closed at first so the listings come first.
const filtersOpen = ref(false)
// How many filters are on, for the button: "Filters (2 on)". Sort is not a filter.
const filtersOn = computed(function () {
  return [
    minPrice.value !== '',
    maxPrice.value !== '',
    storeName.value !== 'All',
    minRating.value > 0
  ].filter(Boolean).length
})

//searched with feature
const searchedWith = ref([])
// Wide screens: one row of 4 to start, and Load More adds a row of 4 at a time.
const ALSO_ROW = 4

//price chart
const searchHistory = computed(function () {
  return result.value && result.value.searchHistory ? result.value.searchHistory : null
})

const chartHistory = computed(function () {
  if (!result.value) {
    return null
  }
  if (searchHistory.value) {
    return searchHistory.value
  }
  // The cheapest listing that has a history, so the last point matches the cheapest price shown.
  let best = null
  for (const row of result.value.listings) {
    if (row.history && (!best || row.price < best.price)) {
      best = row
    }
  }
  return best ? best.history.points : null
})
const alsoShown = ref(ALSO_ROW)

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
    if (minPrice.value !== '' && row.price < Number(minPrice.value)) {
      continue
    }
    if (maxPrice.value !== '' && row.price > Number(maxPrice.value)) {
      continue
    }
    if (storeName.value !== 'All' && row.store !== storeName.value) {
      continue
    }
    if (Number(minRating.value) && row.rating < Number(minRating.value)) {
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

onMounted(async function () {
  const q = String(route.query.q || '').trim()
  if (!q) {
    showFailed()
    return
  }
  await loadResult(q)
  searchedWith.value = await fetchSearchedWith(q,sessionId())
})

// 8 listings a page (two rows of four on wide screens), with the page buttons in the bar under them.
const { page: listPage, pageCount: listPageCount, pageRows, rowCount: listTotal } = useListPages(
  rows,
  [minPrice, maxPrice, storeName, minRating, sortBy]
)
const listingsEl = ref(null)
</script>

<template>
  <FdLoadingSpeed v-if="loading" message="Comparing prices across stores" />

  <div v-else-if="failed" class="alert alert-danger">
    Could not load listings. Search again from the home page.
  </div>

  <div v-else-if="result">
    <FdBreadcrumbs :items="[{ label: 'FastDeal', to: '/' }, { label: itemName(route.query.q) }]" />
    <p v-if="route.query.from === 'photo'" class="small text-secondary mb-1">Identified from your photo</p>
    <h1 class="fd-page-title mb-3">{{ result.name }}</h1>

    <p v-if="note" class="small mb-3" role="status">{{ note }}</p>

    <!-- Price history: the real history of this search once it has enough days, else the demo history. -->
    <section v-if="chartHistory">
      <FdPriceChart :points="chartHistory"
        :note="searchHistory
          ? 'Lowest price across all stores each day, from real searches.'
          : 'Lowest price each day for the cheapest listing in this search (demo data).'" />
    </section>

    <!-- Product listings: the filters, the cards, and their page buttons -->
    <section :class="{ 'fd-section-gap': chartHistory }">
    <h2 class="fd-section-title fd-listings-title">Product listings</h2>

    <!-- Phones: the button is the card's header and the filters open under it, in the same box. -->
    <div class="card fd-card-pad mb-3 fd-filters" :class="{ 'is-open': filtersOpen }">
      <button
        class="d-md-none fd-filter-toggle"
        type="button"
        aria-controls="fd-filters-body"
        :aria-expanded="filtersOpen"
        @click="filtersOpen = !filtersOpen"
      >
        <span>Filters and sort<template v-if="filtersOn"> ({{ filtersOn }} on)</template></span>
        <FdIcon :name="filtersOpen ? 'chevron-up' : 'chevron-down'" />
      </button>

      <div id="fd-filters-body" class="row g-2 fd-filters-body">
        <div class="col-6 col-md">
          <label class="form-label small" for="min">Min price</label>
          <input id="min" v-model.number="minPrice" class="form-control form-control-sm" type="number" min="0" placeholder="Any" />
        </div>
        <div class="col-6 col-md">
          <label class="form-label small" for="max">Max price</label>
          <input id="max" v-model.number="maxPrice" class="form-control form-control-sm" type="number" min="0" placeholder="Any" />
        </div>
        <div class="col-6 col-md">
          <label class="form-label small" for="store">Store</label>
          <select id="store" v-model="storeName" class="form-select form-select-sm">
            <option>All</option>
            <option v-for="name in stores" :key="name">{{ name }}</option>
          </select>
        </div>
        <div class="col-6 col-md">
          <label class="form-label small" for="rating">Min rating</label>
          <select id="rating" v-model.number="minRating" class="form-select form-select-sm">
            <option :value="0">Any</option>
            <option :value="4">4.0+</option>
            <option :value="4.5">4.5+</option>
          </select>
        </div>
        <div class="col-12 col-md">
          <label class="form-label small" for="sort">Sort</label>
          <select id="sort" v-model="sortBy" class="form-select form-select-sm">
            <option value="price">Lowest price</option>
            <option value="rating">Highest rating</option>
            <option value="reviews">Most reviews</option>
          </select>
        </div>
      </div>
    </div>


    <p v-if="!rows.length" class="alert alert-warning">No listings match these filters.</p>

    <div v-else ref="listingsEl" class="fd-listings">
      <ul class="fd-card-grid" role="list">
        <li v-for="row in pageRows" :key="rowKey(row)">
          <article class="fd-listing-card" :class="{ cheapest: row.price === lowInView }">
            <div class="fd-listing-media">
              <img v-img-loading
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
              <span v-if="savedFrom(rowName(row), row.productId) === row.store" class="badge text-bg-dark fd-listing-saved">
                Saved
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

      <!-- Page buttons under the listings. Not sticky: with the "Showing" line the bar is too tall
           and covered the cards, and no other list page sticks its bar any more. -->
      <div class="fd-listings-bar" :class="{ 'has-pager': listTotal > 0 }">
        <FdPager v-model="listPage" :page-count="listPageCount" :total="listTotal" noun="listings" label="Listings" :top="listingsEl" />
      </div>
    </div>
    </section>

    <section v-if="searchedWith.length" class="fd-section-gap">
      <h2 class="fd-section-title fd-also-title">Customers who viewed this also viewed</h2>
      <!-- Below 992px: the first 10 on a belt that rolls past nonstop, the same as Home's Trending Today. -->
      <FdBelt class="d-lg-none" :items="searchedWith.slice(0, 10)" label="Customers who viewed this also viewed">
        <template #default="{ item, tabindex }">
          <router-link :to="{ path: '/compare', query: { q: item.query } }" class="fd-item-link" :tabindex="tabindex">
            <div class="card h-100 fd-item">
              <img v-img-loading :src="item.image" alt="" class="fd-item-img">
              <h5 class="fd-item-title">{{ itemName(item.query) }}</h5>
            </div>
          </router-link>
        </template>
      </FdBelt>
      <!-- 992px and up: one row of 4, with Load More adding a row of 4 at a time. -->
      <div class="d-none d-lg-block">
      <div class="row g-3">
        <div class="col-6 col-md-4 col-lg-3" v-for="item in searchedWith.slice(0, alsoShown)" :key="item._id">
          <router-link :to="{ path: '/compare', query: { q: item.query } }" class="fd-item-link">
            <div class="card h-100 fd-item">
              <img v-img-loading :src="item.image" class="fd-item-img">
              <h5 class="fd-item-title">{{ itemName(item.query) }}</h5>
            </div>
          </router-link>
        </div>
      </div>
      <div class="text-center">
        <button v-if="alsoShown < searchedWith.length" class="btn btn-outline-dark mt-3" @click="alsoShown += ALSO_ROW">Load More</button>
        <p v-else-if="alsoShown > ALSO_ROW" class="small text-secondary mt-3 mb-0">No more items to show</p>
      </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* A section title, with a little more room above the cards than its usual 0.5rem. */
.fd-also-title {
  margin-bottom: 1rem;
}

.fd-listings-title {
  margin-bottom: 1rem;
}

/* Phones: the card's header row opens and closes the filters under it. */
.fd-filter-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  min-height: var(--fd-control);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--fd-blue);
  /* Same type as the pager's Prev and Next */
  font-family: var(--fd-font-body);
  font-size: var(--fd-button);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
}

.fd-filter-toggle:focus-visible {
  border-radius: 0.5rem;
  outline: 0.25rem solid rgb(39 80 138 / 35%);
  outline-offset: 0.25rem;
}

@media (max-width: 767.98px) {
  /* Closed, the card is only as tall as its header row, like a select box. */
  .fd-filters {
    padding-top: 0;
    padding-bottom: 0;
  }

  .fd-filters:not(.is-open) .fd-filters-body {
    display: none;
  }

  /* A line between the header and the filters, like a section inside the card. */
  .fd-filters.is-open .fd-filters-body {
    padding-top: 0.75rem;
    padding-bottom: var(--fd-card-pad);
    border-top: var(--fd-border) solid var(--fd-vanilla-line);
  }
}

/* Sticks to the bottom of the screen while scrolling through the listings and settles under
   the last card, like the Wishlist's total bar. */
.fd-listings-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  /* Same height as the Wishlist's bar, which holds a full-size button. */
  min-height: calc(var(--fd-control) + 1.5rem + var(--fd-border));
  /* Nothing under the bar but the page's own 64px to the footer, or the next section's margin. */
  margin-bottom: 0;
  padding: 0.75rem 0;
  border-top: var(--fd-border) solid var(--fd-vanilla-line);
  background: var(--fd-beige);
}

/* Same type as the Wishlist's total: small, muted. */

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
  padding: var(--fd-card-pad);
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: 1rem;
  background: var(--fd-paper);
  color: var(--fd-text);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/* The cheapest listing is highlighted, mirroring the old table row. */
.fd-listing-card.cheapest {
  border-color: var(--fd-green);
  box-shadow: 0 0 0 2px var(--fd-green);
}

/* Hovering (or tabbing to) a card highlights it with a blue outline. It never grows. */
.fd-listing-card:hover,
.fd-listing-card:has(.fd-listing-link:focus-visible) {
  border-color: var(--fd-blue);
}

.fd-listing-card.cheapest:hover,
.fd-listing-card.cheapest:has(.fd-listing-link:focus-visible) {
  box-shadow: 0 0 0 2px var(--fd-blue);
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
  color: var(--fd-text-muted);
  font-family: var(--fd-font-display);
  font-size: var(--fd-page-title);
}

.fd-listing-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
}

/* Top right, so it never covers the Cheapest badge */
.fd-listing-saved {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}

.fd-listing-body {
  flex: 1;
}

.fd-listing-name {
  margin: 0 0 0.25rem;
  font-size: var(--fd-body);
  font-weight: 700;
  line-height: 1.3;
  /* Clamp long titles to two lines so cards stay even height. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fd-listing-price {
  margin: 0 0 0.125rem;
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  font-size: var(--fd-section-title);
  line-height: 1.1;
}

.fd-listing-store {
  margin: 0 0 0.125rem;
  color: var(--fd-text);
  font-size: var(--fd-small);
}

.fd-listing-meta {
  margin: 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
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

.fd-listing-link:focus-visible {
  text-decoration: underline;
}

/* Phones: the page buttons centred, with their "Showing" line under them. */
.fd-listings-bar.has-pager {
  flex-direction: column;
  justify-content: center;
  gap: 0.75rem;
  /* No bottom padding, so the next section sits exactly the section gap below */
  padding: 1rem 0 0;
}

</style>
