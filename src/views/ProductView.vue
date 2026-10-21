<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import DealCheck from '../components/DealCheck.vue'
import FdLoadingSpeed from '../components/FdLoadingSpeed.vue'
import SaveSleepButtons from '../components/SaveSleepButtons.vue'
import { sgd } from '../mock/catalog.js'
import { itemName } from '../services/itemName.js'
import { fetchProduct } from '../services/productApi.js'

// One product: every store that sells it, cheapest total first, with the Deal check,
// what buyers say and the product details.
// URL: /product/:productId?q=<the search it came from>
const route = useRoute()

const loading = ref(true)
const errorText = ref('')
const product = ref(null)

const cheapest = computed(function () {
  return product.value && product.value.stores.length ? product.value.stores[0] : null
})

const highest = computed(function () {
  const stores = product.value ? product.value.stores : []
  return stores.length > 1 ? stores[stores.length - 1] : null
})

// Same name as the compare page, so one search gives one wishlist row.
const saveName = computed(function () {
  return product.value ? itemName(product.value.searchTerm || product.value.q || route.query.q) : ''
})

const ratingTotal = computed(function () {
  return (product.value ? product.value.ratings : []).reduce(function (sum, row) {
    return sum + row.amount
  }, 0)
})

function percentOf(amount) {
  return ratingTotal.value ? Math.round((amount / ratingTotal.value) * 100) : 0
}

onMounted(async function () {
  try {
    product.value = await fetchProduct(route.params.productId, route.query.q)
  } catch (error) {
    errorText.value = error.message
  } finally {
    loading.value = false
  }
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
    <router-link v-if="route.query.q" class="small" :to="{ path: '/compare', query: { q: route.query.q } }">
      Back to results for "{{ route.query.q }}"</router-link>

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

    <SaveSleepButtons :name="saveName" :listing="cheapest ? { store: cheapest.store, price: cheapest.price } : null" />

    <!-- Ronald: the AI "Buy now or wait?" verdict goes here. The API also returns
         typicalPrice, each store's deal check, ratings and userReviews for it. -->

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
              {{ row.store }}
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
.fd-product-img {
  display: block;
  width: 100%;
  max-height: 260px;
  border-radius: 1rem;
  object-fit: contain;
  background: var(--fd-beige, #f3ede1);
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
