<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import DealCheck from '../components/DealCheck.vue'
import FdBreadcrumbs from '../components/FdBreadcrumbs.vue'
import FdLoadingSpeed from '../components/FdLoadingSpeed.vue'
import SaveSleepButtons from '../components/SaveSleepButtons.vue'
import { sgd } from '../services/format.js'
import { storeToRefs } from 'pinia'
import { useProductStore } from '../store/product.js'
import { itemName } from '../services/itemName.js'
import { fetchWorthIt } from '../services/productApi.js'

// One product: every store that sells it, cheapest total first, with the Deal check,
// what buyers say and the product details.
// URL: /product/:productId?q=<the search it came from>
const route = useRoute()

// The product, its loading state and the cheapest/highest/ratings maths live in the product store.
const { product, loading, errorText, searchedWith, cheapest, highest } = storeToRefs(useProductStore())
const { percentOf, loadProduct } = useProductStore()

// AI "Worth It" verdict (buy now or wait). View-local: it is about presentation here,
// and depends on the cheapest total once the product has loaded.
const worthItVerdict = ref(null)
const worthItLoading = ref(false)
// Seconds elapsed while the verdict is loading, so the user sees it is still working.
const worthItElapsed = ref(0)
let worthItTimer = null

// Store icons from SerpApi. A store with no icon, or one that fails to load, shows its first letter.
const brokenLogos = ref({})

function storeInitial(store) {
  return String(store || '?').trim().charAt(0).toUpperCase()
}

// Bootstrap badge/border tone for each decision.
const WORTH_IT_TONE = {
  buy: 'success',
  wait: 'warning',
  unknown: 'secondary'
}


// What the wishlist stores with this product, so it can open this page again.
const saveInfo = computed(function () {
  if (!product.value) {
    return null
  }
  return { productId: product.value.productId, q: product.value.q || route.query.q || '', image: product.value.image }
})

onMounted(async function () {
  await loadProduct(route.params.productId, route.query.q)
  // Only ask for a verdict once a product with a price is actually on the page.
  if (product.value && cheapest.value && cheapest.value.total > 0) {
    worthItLoading.value = true
    // Tick the elapsed seconds every second while we wait on the AI.
    worthItElapsed.value = 0
    worthItTimer = setInterval(function () {
      worthItElapsed.value += 1
    }, 1000)
    try {
      worthItVerdict.value = await fetchWorthIt(product.value.productId, product.value.q || route.query.q)
    } finally {
      worthItLoading.value = false
      clearInterval(worthItTimer)
      worthItTimer = null
    }
  }
})

// Stop the elapsed timer if the user leaves the page mid-load.
onUnmounted(function () {
  if (worthItTimer) {
    clearInterval(worthItTimer)
    worthItTimer = null
  }
})

// FastDeal / the search (back to its results) / the store the shopper clicked on Compare.
// Without a store (a shared link), the last item is the product itself.
const breadcrumbs = computed(function () {
  const items = [{ label: 'FastDeal', to: '/' }]
  if (route.query.q) {
    items.push({ label: itemName(route.query.q), to: { path: '/compare', query: { q: route.query.q } } })
  }
  items.push({ label: route.query.store || (product.value && product.value.title) || 'Product' })
  return items
})
</script>

<template>
  <FdLoadingSpeed v-if="loading" message="Loading every store for this product"
    slow-note="Still working. The first load can take up to 10 seconds." />

  <div v-else-if="errorText" class="alert alert-danger">
    {{ errorText }}
    <router-link v-if="route.query.q" class="alert-link ms-1" :to="{ path: '/compare', query: { q: route.query.q } }">
      Back to the results</router-link>
  </div>

  <div v-else-if="product">
    <FdBreadcrumbs :items="breadcrumbs" />

    <div class="row g-4 align-items-center mt-1 mb-3">
      <div v-if="product.image" class="col-md-3">
        <img :src="product.image" :alt="product.title" class="fd-product-img" />
      </div>
      <div class="col">
        <p v-if="product.brand" class="small text-secondary mb-1">{{ product.brand }}</p>
        <h1 class="fd-page-title">{{ product.title }}</h1>
        <p class="fd-page-subtitle">
          {{ product.stores.length }} {{ product.stores.length === 1 ? 'store' : 'stores' }}.
          <template v-if="cheapest">Cheapest total is {{ sgd(cheapest.total) }} at {{ cheapest.store }}.</template>
        </p>
        <p v-if="product.rating" class="small text-secondary mb-0">
          ★ {{ Number(product.rating).toFixed(1) }} from {{ product.reviews || 0 }} reviews</p>
      </div>
    </div>

    <SaveSleepButtons :name="product.title" :listing="cheapest ? { store: cheapest.store, price: cheapest.price } : null"
      :product="saveInfo" />

    <!-- AI "Worth It" verdict: buy now or wait for a big sale. Open on load, right under the price,
         because it is the main answer on this page. Sits above the Deal check. -->
    <section v-if="cheapest && (worthItLoading || worthItVerdict)" id="fd-worth-it-panel"
      class="card p-3 mt-3 mb-4 fd-worth-it"
      :class="worthItVerdict ? 'border-' + (WORTH_IT_TONE[worthItVerdict.decision] || 'secondary') : ''"
      aria-labelledby="fd-worth-it-title">
      <div class="d-flex align-items-center gap-2 mb-2">
        <h2 id="fd-worth-it-title" class="fd-section-title mb-0">Worth it?</h2>
        <span class="fd-ai-tag">AI</span>
      </div>

      <p v-if="worthItLoading" class="small text-secondary mb-0 d-flex align-items-center gap-2">
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        <span>Asking our AI whether to buy now or wait…</span>
        <span class="badge text-bg-secondary" aria-live="polite">{{ worthItElapsed }}s elapsed</span>
      </p>

      <template v-else-if="worthItVerdict">
        <p class="mb-1">
          <span class="badge" :class="'text-bg-' + (WORTH_IT_TONE[worthItVerdict.decision] || 'secondary')">
            {{ worthItVerdict.headline }}</span>
        </p>
        <p v-if="worthItVerdict.reason" class="mb-1">{{ worthItVerdict.reason }}</p>
        <p v-if="worthItVerdict.summary" class="small text-secondary mb-1">Based on: {{ worthItVerdict.summary }}</p>
        <p v-if="worthItVerdict.source === 'rules'" class="small text-secondary mb-1">
          The AI did not answer, so this is an estimate from the same numbers with fixed rules. Reload later for
          the AI verdict.</p>
        <p class="small text-secondary mb-2">{{ worthItVerdict.source === 'rules' ? 'Guidance' : 'AI guidance' }} for {{ product.title }} at {{ sgd(cheapest.total) }}.
          Not financial advice.</p>
        <router-link v-if="worthItVerdict.inputs"
          class="btn btn-sm btn-outline-dark align-self-start"
          :to="{ path: '/product/' + product.productId + '/worth-it', query: { q: product.q || route.query.q, store: route.query.store } }">
          See what the AI read</router-link>
      </template>
    </section>

    <section v-if="cheapest" class="card p-3 mb-4">
      <h2 class="fd-section-title mb-2">Deal check</h2>
      <p v-if="product.typicalPrice" class="mb-2">
        Typical price {{ sgd(product.typicalPrice) }} across {{ product.stores.length }} stores.
        Cheapest {{ sgd(cheapest.total) }} at {{ cheapest.store }}<template v-if="highest">,
        highest {{ sgd(highest.total) }} at {{ highest.store }}</template>.
      </p>
      <DealCheck :deal="cheapest.deal" />
      <p class="small text-secondary mb-0 mt-1">We compare the stores that sell this product today.
        Totals include shipping when the store shows it.</p>
    </section>

    <h2 class="fd-section-title">All stores</h2>
    <div class="table-responsive mb-4">
      <table class="table align-middle">
        <thead>
          <tr>
            <th scope="col">Store</th>
            <th scope="col">Price</th>
            <th scope="col">Shipping</th>
            <th scope="col">Total</th>
            <th scope="col">Deal check</th>
            <th scope="col"><span class="visually-hidden">Link</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in product.stores" :key="row.store">
            <td>
              <span class="d-flex align-items-center gap-2">
                <img v-if="row.logo && !brokenLogos[row.store]" :src="row.logo" alt="" class="fd-store-logo"
                  @error="brokenLogos[row.store] = true" />
                <span v-else class="fd-store-logo fd-store-letter" aria-hidden="true">{{ storeInitial(row.store) }}</span>
                <span>{{ row.store }}</span>
              </span>
              <span v-if="row.note" class="d-block small text-secondary">{{ row.note }}</span>
              <span v-if="row.moreOffers" class="d-block small text-secondary">
                +{{ row.moreOffers }} more {{ row.moreOffers === 1 ? 'offer' : 'offers' }} from {{ sgd(row.moreFrom) }}</span>
            </td>
            <td>
              {{ sgd(row.price) }}
              <s v-if="row.oldPrice" class="small text-secondary ms-1">{{ sgd(row.oldPrice) }}</s>
            </td>
            <td>{{ row.shipping || 'Not shown' }}</td>
            <td>{{ sgd(row.total) }}</td>
            <td>
              <DealCheck :deal="row.deal" />
            </td>
            <td>
              <a v-if="row.link" class="btn btn-sm btn-outline-dark" :href="row.link" target="_blank" rel="noopener">
                Go to store</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  
    <div class="row g-4">
      <section v-if="product.ratings.length || product.userReviews.length" class="col-lg-6">
        <h2 class="fd-section-title">What buyers say</h2>
        <div v-for="row in product.ratings" :key="row.stars" class="d-flex align-items-center gap-2 small mb-1">
          <span class="fd-stars">{{ row.stars }} {{ row.stars === 1 ? 'star' : 'stars' }}</span>
          <div class="progress flex-grow-1" role="progressbar" :aria-label="row.stars + ' stars'"
            :aria-valuenow="percentOf(row.amount)" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar fd-star-bar" :style="{ width: percentOf(row.amount) + '%' }"></div>
          </div>
          <span class="fd-star-count text-secondary">{{ percentOf(row.amount) }}%</span>
        </div>

        <blockquote v-for="review in product.userReviews" :key="review.text" class="fd-review mt-3 mb-0">
          <p class="mb-1 small">{{ review.text }}</p>
          <footer class="small text-secondary">
            <template v-if="review.rating">{{ review.rating }}/5. </template>
            <template v-if="review.date">{{ review.date }}. </template>
            <template v-if="review.source">From {{ review.source }}.</template>
          </footer>
        </blockquote>
      </section>

      <section v-if="product.description || product.features.length" class="col-lg-6">
        <h2 class="fd-section-title">About this product</h2>
        <p v-if="product.description" class="small">{{ product.description }}</p>
        <table v-if="product.features.length" class="table table-sm small">
          <tbody>
            <tr v-for="feature in product.features" :key="feature.title">
              <th scope="row" class="fw-semibold">{{ feature.title }}</th>
              <td>{{ feature.value }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Small square store icon (or first letter) before each store name in All stores. */
.fd-store-logo {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  border-radius: 0.375rem;
  background: var(--fd-white);
  object-fit: contain;
}

.fd-store-letter {
  display: grid;
  place-items: center;
  border: 1px solid var(--fd-vanilla-line);
  color: var(--fd-blue);
  font-size: var(--fd-small);
  font-weight: 700;
}

/* AI tag beside the Worth it? title, like the Photo search tag on Home. */
.fd-ai-tag {
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  background: var(--fd-vanilla);
  color: var(--fd-ink);
  font-family: var(--fd-font-body);
  font-size: var(--fd-small);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.fd-product-img {
  display: block;
  width: 100%;
  max-height: 260px;
  padding: 1rem;
  border-radius: 1rem;
  /* White behind every product photo; the whole photo always shows. */
  object-fit: contain;
  background: var(--fd-white);
}

.fd-stars {
  width: 3.5rem;
  flex-shrink: 0;
}

.fd-star-count {
  width: 2.5rem;
  flex-shrink: 0;
  text-align: right;
}

.fd-star-bar {
  background: var(--fd-blue, #2b5797);
}

.fd-review {
  padding-left: 0.75rem;
  border-left: 3px solid var(--fd-border, #d9d2c3);
}
</style>
