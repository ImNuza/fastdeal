<script setup>
// Deal check for one store: how its price compares with the other stores today,
// whether its "was" price is believable, and whether a store sale is coming.
// deal comes from the server (services/dealCheck.js):
// { price: { label, tone, detail }, was: { label, tone, detail } | null, sale: { text } | null }
defineProps({
  deal: {
    type: Object,
    default: null
  }
})

// Bootstrap badge class for each tone
const BADGE = {
  good: 'text-bg-success',
  warn: 'text-bg-warning',
  bad: 'text-bg-danger',
  muted: 'text-bg-secondary'
}
</script>

<template>
  <div class="fd-deal small">
    <p v-for="check in [deal && deal.price, deal && deal.was].filter(Boolean)" :key="check.label" class="mb-1">
      <span class="badge" :class="BADGE[check.tone]">{{ check.label }}</span>
      <span class="text-secondary ms-1">{{ check.detail }}</span>
    </p>
    <p v-if="deal && deal.sale" class="mb-1">{{ deal.sale.text }}</p>
  </div>
</template>
