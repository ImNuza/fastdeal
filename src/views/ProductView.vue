<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import FdBreadcrumbs from '../components/FdBreadcrumbs.vue'
import FdIcon from '../components/FdIcon.vue'
import FdLoadingSpeed from '../components/FdLoadingSpeed.vue'
import FdScrollArea from '../components/FdScrollArea.vue'
import SaveSleepButtons from '../components/SaveSleepButtons.vue'
import { sgd } from '../services/format.js'
import { storeToRefs } from 'pinia'
import { useProductStore } from '../store/product.js'
import { itemName } from '../services/itemName.js'
import { fetchWorthIt } from '../services/productApi.js'
import FdPager from '../components/FdPager.vue'
import { useListPages } from '../services/listPages.js'

// One product: the listings from its search (the same ones Compare shows), cheapest first, with the
// one the shopper clicked as Your pick, the AI verdict, what buyers say and the product details.
// URL: /product/:productId?q=<the search it came from>
const route = useRoute()

// The product, its loading state and the cheapest/ratings maths live in the product store.
const { product, loading, errorText, searchedWith, cheapest } = storeToRefs(useProductStore())
const { loadProduct } = useProductStore()

// AI "Worth It" verdict (buy now or wait). View-local: it is about presentation here,
// and depends on the cheapest total once the product has loaded.
const worthItVerdict = ref(null)
const worthItLoading = ref(false)
// Seconds elapsed while the verdict is loading, so the user sees it is still working.
const worthItElapsed = ref(0)
let worthItTimer = null

// First letter, shown in the photo square when the product has no photo.
function storeInitial(store) {
  return String(store || '?').trim().charAt(0).toUpperCase()
}

// Bootstrap badge/border tone for each decision.
// The tag's words for each decision. Fixed, so the tag never repeats the product name the way the
// AI's own headline can ("Buy Smart Balance Wheel now").
const WORTH_IT_LABEL = {
  buy: 'Buy now',
  wait: 'Wait for a sale',
  unknown: 'No verdict yet'
}

const WORTH_IT_TONE = {
  buy: 'success',
  wait: 'warning',
  unknown: 'secondary'
}

// "Wait for 11.11" when the verdict names the coming sale, else the fixed words.
const worthItLabel = computed(function () {
  const v = worthItVerdict.value
  if (!v) {
    return WORTH_IT_LABEL.unknown
  }
  if (v.decision === 'wait' && v.saleName) {
    return 'Wait for ' + v.saleName
  }
  return WORTH_IT_LABEL[v.decision] || WORTH_IT_LABEL.unknown
})


// All listings: the listings from the search, the same ones and the same number as on Compare,
// cheapest first (the server sorts them). The verdict reads the same rows.
const allStores = computed(function () {
  return product.value ? product.value.stores : []
})

// Your pick: the listing the shopper clicked on Compare. Every other row is compared with it, and the
// price, Save and Go to store at the top are its own. When the search no longer has that listing,
// the store picked on Compare (?store=), else the cheapest listing.
const pickedRow = computed(function () {
  const pick = product.value && product.value.pick
  if (pick) {
    return allStores.value.find(function (row) { return row.productId === pick.productId }) || null
  }
  const picked = route.query.store
  return picked ? allStores.value.find(function (row) { return row.store === picked }) || null : null
})

const baseRow = computed(function () {
  return pickedRow.value || cheapest.value
})

// The search, as a product name, for the All listings line: "Apple iPhone 16 Pro".
const searchName = computed(function () {
  return itemName((product.value && product.value.q) || route.query.q || '')
})

// How much more (+) or less (-) a row's total is than the base row's, in cents-safe dollars.
function diffFromBase(row) {
  return Math.round((row.total - baseRow.value.total) * 100) / 100
}

// Your pick's saving against its own crossed-out "was" price, or null when it shows none.
const saving = computed(function () {
  const row = baseRow.value
  if (!row || !row.oldPrice || row.oldPrice <= row.price) {
    return null
  }
  const amount = Math.round((row.oldPrice - row.price) * 100) / 100
  return { amount: amount, percent: Math.round((amount / row.oldPrice) * 100) }
})

// All listings shows STORES_IN_VIEW rows at a time and scrolls for the rest. Rows differ in height
// (a "Listed as" line, a note), so the box is measured to end exactly at the bottom of the third row.
// Re-measured whenever the rows change size: a new product, or the screen width changing.
const STORES_IN_VIEW = 3
const storeRows = ref(null)
const storesHeight = ref('none')
let storesObserver = null

function measureStores() {
  const rows = storeRows.value ? storeRows.value.children : []
  if (rows.length <= STORES_IN_VIEW) {
    storesHeight.value = 'none'
    return
  }
  const top = rows[0].getBoundingClientRect().top
  const bottom = rows[STORES_IN_VIEW - 1].getBoundingClientRect().bottom
  storesHeight.value = Math.ceil(bottom - top) + 'px'
}

watch(storeRows, function (el) {
  storesObserver?.disconnect()
  if (el) {
    storesObserver = new ResizeObserver(measureStores)
    storesObserver.observe(el)
  }
})


// The verdict as one paragraph: the reason, what it was based on, and the fallback note when
// the AI did not answer. Joined with spaces so the sentences never run together.
const verdictText = computed(function () {
  const v = worthItVerdict.value
  if (!v) {
    return ''
  }
  return [
    v.reason,
    v.summary ? 'Based on: ' + v.summary : '',
    v.source === 'rules'
      ? 'The AI did not answer, so this is an estimate from the same numbers with fixed rules. Reload later for the AI verdict.'
      : ''
  ].filter(Boolean).join(' ')
})

// "See how the AI decided" pop-up: the steps behind the verdict, each with the numbers it used,
// from the verdict already on the page. Focus moves to Got it when it opens and back to the button
// when it closes.
const aiReadOpen = ref(false)
const aiReadDialog = ref(null)
let aiReadOpener = null

// The steps follow the prompt the AI is given (services/worthItInputs.js): your pick, the cheapest
// listing, then the typical price and range, any listing already on sale, then the next big sale.
// When the AI did not answer, the fixed rules that made the verdict instead.
// A value quoted mid-sentence starts lower case ("no store shows..."), unless it starts with a
// name or number such as "S$" or "11.11".
function midSentence(text) {
  const value = String(text || '')
  return /^[A-Z][a-z]/.test(value) ? value.charAt(0).toLowerCase() + value.slice(1) : value
}

const aiSteps = computed(function () {
  const v = worthItVerdict.value
  if (!v || !v.inputs) {
    return []
  }
  const input = {}
  for (const row of v.inputs) {
    input[row.key] = row
  }
  const steps = []
  if (input.pick) {
    steps.push('Took your pick: ' + input.pick.value + '.')
  }
  if (input.cheapest) {
    steps.push('Found the cheapest listing in your search: ' + input.cheapest.value + '.')
  }
  if (input.typical && input.typical.sent) {
    steps.push('Compared it with the typical price, ' + input.typical.value + ', and the range, ' +
      (input.range ? input.range.value : 'not shown') + '.')
  } else if (input.range) {
    steps.push('Too few listings for a typical price, so it used the range instead: ' + input.range.value + '.')
  }
  if (input['sale-now']) {
    steps.push('Checked for a listing already on sale: ' + midSentence(input['sale-now'].value) + '.')
  }
  if (input['next-sale'] && input['next-sale'].sent) {
    steps.push('Weighed buying now against waiting for the next big sale: ' + input['next-sale'].value + '.')
  } else {
    steps.push('No big sale is coming up, so there was no sale to wait for.')
  }
  if (input.rating && input.rating.sent) {
    steps.push('Also saw the rating: ' + input.rating.value + '.')
  }
  if (v.source === 'rules') {
    steps.push('The AI did not answer, so fixed rules decided: 10% or more under the typical price is a buy, ' +
      'and 10% or more over it is a wait. Otherwise, a big sale within 14 days is worth the wait. ' +
      'Otherwise, the price is fair.')
  }
  return steps
})

function openAiRead(event) {
  aiReadOpener = event.currentTarget
  aiReadOpen.value = true
  nextTick(function () { aiReadDialog.value?.querySelector('button')?.focus() })
}

function closeAiRead() {
  aiReadOpen.value = false
  nextTick(function () { aiReadOpener?.focus() })
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
  if (product.value && baseRow.value && baseRow.value.total > 0) {
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
  storesObserver?.disconnect()
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

// Phones: 10 rows a page, with the page buttons in the bar. Wider: the count only.
const { page: listPage, pageCount: listPageCount, pageRows, rowCount: listTotal, isPhone: listOnPhone } = useListPages(
  allStores,
  null
)
const storeTable = ref(null)
</script>

<template>
  <FdLoadingSpeed v-if="loading" message="Loading the listings for this product"
    slow-note="Still working. The first load can take up to 10 seconds." />

  <div v-else-if="errorText" class="alert alert-danger">
    {{ errorText }}
    <router-link v-if="route.query.q" class="alert-link ms-1" :to="{ path: '/compare', query: { q: route.query.q } }">
      Back to the results</router-link>
  </div>

  <div v-else-if="product">
    <FdBreadcrumbs :items="breadcrumbs" />

    <!-- Hero: the photo on the left; the title, price and buttons on the right. -->
    <div class="row g-4 g-lg-5 fd-product-hero">
      <div class="col-md-4">
        <div class="fd-product-frame">
          <img v-if="product.image" :src="product.image" :alt="product.title" class="fd-product-img" />
          <span v-else class="fd-product-ph" aria-hidden="true">{{ storeInitial(product.title) }}</span>
        </div>
      </div>

      <!-- As tall as the photo: the title and price at the top, the facts and buttons at the bottom,
           so the buttons always line up with the bottom of the photo. -->
      <div class="col-md-8 fd-product-info">
        <div class="fd-product-top">
        <p v-if="product.brand" class="small text-secondary mb-1">{{ product.brand }}</p>
        <h1 class="fd-page-title">{{ product.title }}</h1>

        <p v-if="product.rating" class="fd-product-rating">
          <span class="fd-rating-stars" aria-hidden="true">
            <span v-for="n in 5" :key="n" :class="{ 'is-off': n > Math.round(product.rating) }">★</span>
          </span>
          <strong>{{ Number(product.rating).toFixed(1) }}</strong>
          <!-- A link only when the What buyers say section is on the page to jump to. -->
          <a v-if="product.reviews && product.userReviews.length" class="fd-text-link" href="#fd-reviews">
            from {{ Number(product.reviews).toLocaleString('en-SG') }} reviews</a>
          <span v-else-if="product.reviews">from {{ Number(product.reviews).toLocaleString('en-SG') }} reviews</span>
        </p>

        <!-- Your pick's price now. A crossed-out "was" price and a Save tag when the store shows one. -->
        <div v-if="baseRow" class="fd-product-price">
          <s v-if="saving" class="d-block text-secondary">{{ sgd(baseRow.oldPrice) }}</s>
          <div class="d-flex flex-wrap align-items-center gap-2">
            <span class="fd-price-now">{{ sgd(baseRow.total) }}</span>
            <span v-if="saving" class="fd-save-tag">Save {{ sgd(saving.amount) }} | {{ saving.percent }}% off</span>
          </div>
        </div>

        </div>

        <div class="fd-product-bottom">
        <!-- Three quick facts, like the trust row on a shop's product page. -->
        <ul class="fd-product-facts" role="list">
          <li>
            <FdIcon name="scale" />
            <span>{{ allStores.length }} {{ allStores.length === 1 ? 'listing' : 'listings' }} compared</span>
          </li>
          <li v-if="baseRow">
            <FdIcon name="cart" />
            <span>Shipping: {{ baseRow.shipping || 'not shown' }}</span>
          </li>
          <li>
            <FdIcon name="sparkles" />
            <span>AI buy or wait verdict</span>
          </li>
        </ul>

        <!-- Save to wishlist, Sleep on it, then Go to store (your pick's page) in one row. -->
        <SaveSleepButtons :name="product.title" :listing="baseRow ? { store: baseRow.store, price: baseRow.price } : null"
          :product="saveInfo">
          <a v-if="baseRow && baseRow.link" class="btn btn-outline-dark" :href="baseRow.link"
            target="_blank" rel="noopener">Go to store</a>
        </SaveSleepButtons>
        </div>
      </div>
    </div>

    <!-- AI "Worth It" verdict: buy now or wait for a big sale. First under the hero, because it is
         the main answer on this page. -->
    <section v-if="baseRow && (worthItLoading || worthItVerdict)" id="fd-worth-it-panel" class="mb-5"
      aria-labelledby="fd-worth-it-title">
      <!-- The title and AI tag sit above the card, like All listings, so it reads as its own section. -->
      <div class="d-flex align-items-center gap-2 mb-2">
        <h2 id="fd-worth-it-title" class="fd-section-title mb-0">Worth it?</h2>
        <span class="fd-ai-tag">AI</span>
      </div>

      <div class="card fd-worth-it"
        :class="worthItVerdict ? 'border-' + (WORTH_IT_TONE[worthItVerdict.decision] || 'secondary') : ''">
        <!-- The verdict tag in the card's top right corner; the reason flows beside it. -->
        <span v-if="worthItVerdict && !worthItLoading" class="badge fd-verdict-tag"
          :class="'text-bg-' + (WORTH_IT_TONE[worthItVerdict.decision] || 'secondary')">
          {{ worthItLabel }}</span>

      <p v-if="worthItLoading" class="small text-secondary mb-0 d-flex align-items-center gap-2">
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        <span>Asking our AI whether to buy now or wait…</span>
        <span class="badge text-bg-secondary" aria-live="polite">{{ worthItElapsed }}s elapsed</span>
      </p>

      <template v-else-if="worthItVerdict">
        <!-- The verdict as one paragraph in body text; only the disclaimer under it is small. -->
        <!-- The reason and Based on in one paragraph; a bigger gap sets the disclaimer apart. -->
        <p class="mb-3">{{ verdictText }}</p>
        <p class="small text-secondary mb-3">{{ worthItVerdict.source === 'rules' ? 'Guidance' : 'AI guidance' }} for {{ product.title }} at {{ sgd(baseRow.total) }}.
          Not financial advice.</p>
        <button v-if="worthItVerdict.inputs" class="btn btn-outline-dark align-self-start" type="button"
          @click="openAiRead">See how the AI decided</button>
      </template>
      </div>
    </section>

    <h2 id="fd-all-stores" class="fd-section-title">All listings</h2>
    <p v-if="baseRow" class="small text-secondary">
      The {{ allStores.length === 1 ? 'listing' : allStores.length + ' listings' }} from your search<template
        v-if="searchName"> for "{{ searchName }}"</template>, the same as on Compare.
      Prices marked + or − are against {{ baseRow.store }},
      {{ pickedRow ? 'your pick' : 'the cheapest listing' }}.
      A listing can be a different model or size, so check its name.
    </p>
    <!-- Built like the Wishlist table: a blue header pill, then one card per listing. Roles keep it a
         table for screen readers. Google Shopping gives no shipping amount, so there is no Total column. -->
    <div ref="storeTable" class="fd-store-table fd-store-panel" role="table" aria-label="All listings">
      <div class="fd-store-head" role="row">
        <span role="columnheader">Store</span>
        <span role="columnheader">Price</span>
        <span role="columnheader">Shipping</span>
        <span role="columnheader"><span class="visually-hidden">Link</span></span>
      </div>
      <!-- Three listings at a time; the rest scroll inside, with the brand scrollbar like the Wishlist. -->
      <FdScrollArea label="All listings" class="fd-store-scroll" :style="{ maxHeight: storesHeight }">
      <div ref="storeRows" class="fd-store-rows" role="rowgroup">
        <div v-for="(row, i) in pageRows" :key="i + row.store" class="fd-store-row" role="row">
          <div class="fd-store-cell fd-store-cell-name" role="cell">
            <strong class="d-block">{{ row.store }}</strong>
            <span v-if="row.note" class="d-block small text-secondary">{{ row.note }}</span>
            <!-- Name the listing, since it can be a different model. -->
            <span v-if="row.name" class="d-block small text-secondary fd-store-listing">
              Listed as: {{ row.name }}</span>
            <span v-if="row.moreOffers" class="d-block small text-secondary">
              +{{ row.moreOffers }} more {{ row.moreOffers === 1 ? 'offer' : 'offers' }} from {{ sgd(row.moreFrom) }}</span>
          </div>
          <div class="fd-store-cell" role="cell">
            <span class="fd-store-label" aria-hidden="true">Price</span>
            <strong>{{ sgd(row.total) }}</strong>
            <s v-if="row.oldPrice" class="small text-secondary ms-1">{{ sgd(row.oldPrice) }}</s>
            <!-- Against your pick: Your pick on its own row, else how much less or more. -->
            <span v-if="baseRow && row === baseRow" class="fd-diff fd-diff-pick">{{ pickedRow ? 'Your pick' : 'Cheapest' }}</span>
            <template v-else-if="baseRow">
              <span v-if="diffFromBase(row) < 0" class="fd-diff fd-diff-less"
                :title="sgd(-diffFromBase(row)) + ' less than ' + baseRow.store">
                −{{ sgd(-diffFromBase(row)) }}<span class="visually-hidden"> less than {{ baseRow.store }}</span></span>
              <span v-else-if="diffFromBase(row) > 0" class="fd-diff fd-diff-more"
                :title="sgd(diffFromBase(row)) + ' more than ' + baseRow.store">
                +{{ sgd(diffFromBase(row)) }}<span class="visually-hidden"> more than {{ baseRow.store }}</span></span>
              <span v-else class="fd-diff">Same price</span>
            </template>
          </div>
          <div class="fd-store-cell" role="cell">
            <span class="fd-store-label" aria-hidden="true">Shipping</span>
            {{ row.shipping || 'Not shown' }}
          </div>
          <div class="fd-store-cell fd-store-cell-link" role="cell">
            <a v-if="row.link" class="btn btn-sm btn-outline-dark" :href="row.link" target="_blank" rel="noopener">
              Go to store</a>
          </div>
        </div>
      </div>
      </FdScrollArea>
    </div>
    <!-- The total under the card, worded and placed like the Friends and Wishlist totals. -->
    <div v-if="listTotal > 0" class="fd-store-foot" :class="{ 'has-pager': listOnPhone && listTotal > 0 }">
      <FdPager v-model="listPage" :page-count="listPageCount" :total="listTotal" :buttons="listOnPhone" noun="listings" label="Listings" :top="storeTable" />
    </div>

    <!-- What buyers say: one card per review, in a row that scrolls sideways. -->
    <section v-if="product.userReviews.length" id="fd-reviews" class="mb-5">
      <h2 class="fd-section-title">What buyers say</h2>
      <!-- Only the top 3 reviews show here; the rest are on the product's Google Shopping page. -->
      <p v-if="product.reviewsLink" class="small text-secondary mb-3">
        The top {{ product.userReviews.length }} reviews.
        <a class="fd-text-link" :href="product.reviewsLink" target="_blank" rel="noopener">
          See all {{ product.reviews ? Number(product.reviews).toLocaleString('en-SG') + ' ' : '' }}reviews</a>
      </p>
      <ul class="fd-review-row" role="list">
        <li v-for="review in product.userReviews" :key="review.text" class="fd-review-card">
          <p v-if="review.rating" class="fd-rating-stars mb-2" :aria-label="'Rated ' + review.rating + ' out of 5'">
            <span v-for="n in 5" :key="n" :class="{ 'is-off': n > Math.round(review.rating) }" aria-hidden="true">★</span>
          </p>
          <p class="fd-review-text">{{ review.text }}</p>
          <p class="small text-secondary mb-0">
            <template v-if="review.date">{{ review.date }}. </template>
            <template v-if="review.source">From {{ review.source }}.</template>
          </p>
        </li>
      </ul>
    </section>
  </div>


  <!-- How the AI decided: the Wishlist's pop-up format (paper card, page title, grey intro, Got it). -->
  <div v-if="aiReadOpen && worthItVerdict" class="fd-entry-backdrop" @click.self="closeAiRead" @keydown.esc="closeAiRead">
    <section ref="aiReadDialog" class="fd-entry-dialog fd-dialog-wide" role="dialog" aria-modal="true"
      aria-labelledby="fd-ai-read-title">
      <h2 id="fd-ai-read-title" class="fd-page-title">How the AI decided</h2>
      <p class="fd-entry-description">
        Why it says "{{ worthItLabel }}", step by step, using today's prices from your search.
      </p>

      <ol class="fd-ai-steps">
        <li v-for="step in aiSteps" :key="step">{{ step }}</li>
      </ol>

      <button class="btn btn-dark fd-btn-lg w-100" type="button" @click="closeAiRead">Got it</button>
    </section>
  </div>
</template>

<style scoped>
/* Cards on this page use the app's card padding token (--fd-card-pad), like every other page. */
.fd-worth-it {
  /* Block, not Bootstrap's column flex, so the verdict tag can float in the top right corner. */
  display: block;
  padding: var(--fd-card-pad);
}

.fd-verdict-tag {
  float: right;
  margin: 0 0 0.5rem 1rem;
}

/* The verdict text takes 3/4 of the card's width on wider screens, so lines stay short enough to
   read; the tag keeps the top right corner. Phones use the full width. */
@media (min-width: 768px) {
  .fd-worth-it > p {
    max-width: 75%;
  }
}

/* All listings, built like the Wishlist table: a blue header pill and one card per listing,
   sharing the same four columns so everything lines up. */
.fd-store-head,
.fd-store-row {
  display: grid;
  /* The store takes all the free room; Price and Shipping are narrow, fixed columns on the right. */
  grid-template-columns: minmax(0, 1fr) 8rem 7rem 8rem;
  align-items: center;
  gap: 1rem;
  padding: var(--fd-row-pad);
}

.fd-store-head {
  /* Clear of the scrollbar's column, so the header lines up with the rows (like the Wishlist). */
  margin: 0 1.75rem 0.75rem 0;
  white-space: nowrap;
  border-radius: 999px;
  background: var(--fd-blue);
  color: var(--fd-beige);
  font-size: var(--fd-table-header);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Phones: the listings have no scrollbar (see FdScrollArea), so no room is kept for one. */
@media (max-width: 767.98px) {
  .fd-store-head {
    margin-right: 0;
  }
}

/* The card around All listings: paper, vanilla line and corners, like the Wishlist and Friends
   cards, without their folder tabs. */
.fd-store-panel {
  padding: var(--fd-card-pad);
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: var(--fd-radius);
  background: var(--fd-paper);
}

/* Under the card, on the right: small and muted like the Wishlist's total. It belongs to the
   card, so the next section starts closer under it: the card's bottom to the next title is about
   the same as the 48px between the other sections. */
/* The pager on the left (phones only), the total on the right */
.fd-store-foot {
  display: flex;
  align-items: center;
  gap: 0.5rem 1rem;
  margin: 0 0 1.25rem;
  padding: 0.5rem 0 0;
}


.fd-store-rows {
  display: grid;
  gap: 0.75rem;
}

.fd-store-row {
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: var(--fd-radius);
  background: var(--fd-paper);
  transition: border-color 0.15s ease;
}

/* Same blue edge on hover as the Wishlist cards */
.fd-store-row:hover {
  border-color: var(--fd-blue);
}

.fd-store-cell {
  min-width: 0;
}

.fd-store-cell-link {
  text-align: right;
}

.fd-store-label {
  display: none;
}

/* + or - against your pick, under each price: a small pill like the Wishlist's price drop
   chip. Tea green for less, soft red for more, vanilla for the picked store; ink text on all. */
.fd-diff {
  display: table;
  margin-top: 0.25rem;
  padding: 0.0625rem 0.5rem;
  border-radius: 999px;
  background: var(--fd-vanilla-line);
  color: var(--fd-ink);
  font-size: var(--fd-small);
  font-weight: 700;
  white-space: nowrap;
}

.fd-diff-less {
  background: var(--fd-green);
}

.fd-diff-more {
  background: var(--fd-red);
}

.fd-diff-pick {
  background: var(--fd-vanilla);
}

/* Long listing names stop at two lines. */
.fd-store-listing {
  display: -webkit-box !important;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Below 992px there is no room for four columns: the header pill is hidden and each card shows
   its own small labels, like the Wishlist. */
@media (max-width: 991.98px) {
  .fd-store-head {
    display: none;
  }

  .fd-store-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    padding: 1rem;
  }

  .fd-store-cell-name,
  .fd-store-cell-link {
    grid-column: 1 / -1;
  }

  .fd-store-cell-link {
    text-align: left;
  }

  .fd-store-label {
    display: block;
    margin-bottom: 0.25rem;
    color: var(--fd-text-muted);
    font-size: var(--fd-table-header);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
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

/* The same gap under the hero as under the breadcrumbs, so the AI verdict sits as close. */
.fd-product-hero {
  margin-bottom: 1.75rem;
}

/* A fixed white square for the product photo, whatever the photo's size or shape. */
.fd-product-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  padding: 2rem;
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: var(--fd-radius);
  background: var(--fd-white);
}

/* The whole photo always shows, centred in the square. */
.fd-product-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* No photo: the first letter, like the listing cards on Compare. */
.fd-product-ph {
  color: var(--fd-text-muted);
  font-family: var(--fd-font-display);
  font-size: var(--fd-page-title);
}

/* Stars: filled ones blue, the rest a vanilla line colour. */
.fd-rating-stars {
  display: inline-flex;
  gap: 0.125rem;
  color: var(--fd-blue);
  letter-spacing: 0;
}

.fd-rating-stars .is-off {
  color: var(--fd-vanilla-line);
}

.fd-product-rating {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

/* Price: a big number, so Anton, at the section title size like the prices on Compare's cards,
   one step under the product title. */
.fd-product-price {
  margin-bottom: 1rem;
}

.fd-price-now {
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  font-size: var(--fd-section-title);
  line-height: 1.1;
}

/* Save tag beside the price, in the vanilla tag look. */
.fd-save-tag {
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  background: var(--fd-vanilla-soft);
  color: var(--fd-text);
  font-size: var(--fd-table-header);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* The details column is as tall as the photo, and everything in it is centred vertically as
   one group, with a fixed gap between the price and the facts. */
.fd-product-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.fd-product-bottom {
  margin-top: 1.5rem;
}

/* Three quick facts in a row, each a small icon and a short caption. */
.fd-product-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  margin: 0 0 1.25rem;
  padding: 0;
  list-style: none;
}

.fd-product-facts li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--fd-text);
  font-size: var(--fd-small);
}

.fd-product-facts :deep(svg) {
  color: var(--fd-blue);
}

/* The reviews link jumps here; it stops below the sticky navbar, not under it. */
#fd-reviews {
  scroll-margin-top: calc(var(--fd-nav-height) + 1.5rem);
}

/* How the AI decided pop-up: numbered steps, body text, a little room between them. */
.fd-ai-steps {
  display: grid;
  gap: 0.625rem;
  margin: 0 0 1.5rem;
  padding-left: 1.25rem;
}

.fd-ai-steps li::marker {
  color: var(--fd-blue);
  font-weight: 700;
}

/* What buyers say: paper cards in one row that scrolls sideways. */
.fd-review-row {
  display: grid;
  grid-auto-columns: minmax(16rem, 1fr);
  grid-auto-flow: column;
  gap: 1rem;
  margin: 0;
  padding: 0 0 0.5rem;
  list-style: none;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}

.fd-review-card {
  padding: var(--fd-card-pad);
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: var(--fd-radius);
  background: var(--fd-paper);
  scroll-snap-align: start;
}

/* Long reviews stop at five lines so the cards stay even. */
.fd-review-text {
  display: -webkit-box;
  margin-bottom: 0.5rem;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}


/* Phones: the page buttons centred, with their "Showing" line under them. */
.fd-store-foot.has-pager {
  flex-direction: column;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem 0 1.25rem;
}

</style>
