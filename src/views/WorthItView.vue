<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import FdBreadcrumbs from '../components/FdBreadcrumbs.vue'
import FdLoadingSpeed from '../components/FdLoadingSpeed.vue'
import { itemName } from '../services/itemName.js'
import { fetchWorthIt } from '../services/productApi.js'

// How the AI "Worth it?" verdict was made: every input it read, where each one came from,
// what was missing, and the exact prompt. Opened from "See what the AI read" on the product page.
// URL: /product/:productId/worth-it?q=<the search it came from>
// The server saves each verdict for the day, so this page shows the same verdict as the product page
// and does not ask the AI again.
const route = useRoute()

const verdict = ref(null)
const loading = ref(true)

// Bootstrap badge/border tone for each decision, as on the product page.
const TONE = {
  buy: 'success',
  wait: 'warning',
  unknown: 'secondary'
}

// What the AI never sees, so nobody reads more into the verdict than is there.
const NOT_READ = [
  'Review text. It reads the star rating and the number of reviews only.',
  'Prices from other countries, or stores that are not in the store list.',
  'Past prices from before FastDeal started tracking this product.',
  'Your budget, your wishlist or anything about you.'
]

const productTitle = computed(function () {
  return verdict.value && verdict.value.product ? verdict.value.product.title : 'Product'
})

const productLink = computed(function () {
  return { path: '/product/' + route.params.productId, query: { q: route.query.q, store: route.query.store } }
})

const breadcrumbs = computed(function () {
  const items = [{ label: 'FastDeal', to: '/' }]
  if (route.query.q) {
    items.push({ label: itemName(route.query.q), to: { path: '/compare', query: { q: route.query.q } } })
  }
  items.push({ label: productTitle.value, to: productLink.value })
  items.push({ label: 'How the AI decided' })
  return items
})

const sentCount = computed(function () {
  return verdict.value && verdict.value.inputs ? verdict.value.inputs.filter(function (row) { return row.sent }).length : 0
})

// "31 Oct, 4:05 pm" in Singapore time
function madeText(iso) {
  return new Date(iso).toLocaleString('en-SG', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore'
  })
}

onMounted(async function () {
  try {
    verdict.value = await fetchWorthIt(route.params.productId, route.query.q)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <FdLoadingSpeed v-if="loading" message="Loading what the AI read" />

  <div v-else-if="verdict && verdict.inputs">
    <FdBreadcrumbs :items="breadcrumbs" />

    <h1 class="fd-page-title">How the AI decided</h1>
    <p class="fd-page-subtitle">
      Everything our AI read before it gave this verdict for {{ productTitle }}. Nothing else goes in.
    </p>

    <section class="card p-3 mb-4 fd-worth-it" :class="'border-' + (TONE[verdict.decision] || 'secondary')"
      aria-labelledby="fd-ai-verdict-title">
      <div class="d-flex align-items-center gap-2 mb-2">
        <h2 id="fd-ai-verdict-title" class="fd-section-title mb-0">The verdict</h2>
        <span class="fd-ai-tag">AI</span>
      </div>
      <p class="mb-1">
        <span class="badge" :class="'text-bg-' + (TONE[verdict.decision] || 'secondary')">{{ verdict.headline }}</span>
      </p>
      <p v-if="verdict.reason" class="mb-1">{{ verdict.reason }}</p>
      <p class="small text-secondary mb-0">
        <template v-if="verdict.madeAt">Made {{ madeText(verdict.madeAt) }} by {{ verdict.source }}.</template>
        <template v-else>The AI did not answer, so this is the standard message.</template>
        The same verdict is kept for the rest of the day, unless the cheapest price changes.
      </p>
    </section>

    <h2 class="fd-section-title">What the AI read</h2>
    <p class="small text-secondary">
      {{ sentCount }} of {{ verdict.inputs.length }} inputs were sent. An input with no data is not sent,
      so the AI never guesses it.
    </p>
    <div class="table-responsive mb-4">
      <table class="table align-middle">
        <thead>
          <tr>
            <th scope="col">Input</th>
            <th scope="col">Value</th>
            <th scope="col">Source</th>
            <th scope="col">Sent to the AI</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in verdict.inputs" :key="row.key" :class="{ 'text-secondary': !row.sent }">
            <th scope="row" class="fw-semibold">{{ row.label }}</th>
            <td>{{ row.value }}</td>
            <td class="small">{{ row.source }}</td>
            <td>
              <span v-if="row.sent" class="badge text-bg-success">Sent</span>
              <span v-else class="badge text-bg-secondary">Not sent</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="row g-4 mb-4">
      <section class="col-lg-6" aria-labelledby="fd-not-read-title">
        <h2 id="fd-not-read-title" class="fd-section-title">What the AI does not read</h2>
        <ul class="small mb-0">
          <li v-for="line in NOT_READ" :key="line">{{ line }}</li>
        </ul>
      </section>

      <section class="col-lg-6" aria-labelledby="fd-prompt-title">
        <h2 id="fd-prompt-title" class="fd-section-title">The exact prompt</h2>
        <details class="fd-prompt">
          <summary>Show the text sent to Gemini</summary>
          <pre>{{ verdict.prompt }}</pre>
        </details>
      </section>
    </div>

    <router-link class="btn btn-outline-dark" :to="productLink">Back to the product</router-link>
  </div>

  <div v-else class="alert alert-secondary">
    {{ (verdict && verdict.reason) || 'We could not load this verdict.' }}
    <router-link class="alert-link ms-1" :to="productLink">Back to the product</router-link>
  </div>
</template>

<style scoped>
/* AI tag beside the title, like the Photo search tag on Home. */
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

/* The prompt in a white box with the card border, so it reads as raw text. */
.fd-prompt summary {
  color: var(--fd-blue);
  font-weight: 700;
  cursor: pointer;
}

.fd-prompt pre {
  margin: 0.75rem 0 0;
  padding: 1rem;
  border: 1px solid var(--fd-vanilla-line);
  border-radius: 0.75rem;
  background: var(--fd-white);
  color: var(--fd-text);
  font-size: var(--fd-small);
  white-space: pre-wrap;
}
</style>
