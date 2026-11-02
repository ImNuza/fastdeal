<script setup>
import FdIcon from './FdIcon.vue'
import FdLoadingDots from './FdLoadingDots.vue'

// The search pill above a list: filter your friends, notifications, wishlist, budgets, users.
// Built like the Home search bar, minus the photo search. Put it in a .fd-list-tools row so it
// ends where the cards end. Styles are in app.css (.fd-list-search).
defineProps({
  placeholder: {
    type: String,
    default: 'Search'
  },
  // What it searches, for screen readers: "Search your wishlist"
  label: {
    type: String,
    required: true
  },
  // True while a search is on its way, to show the loading dots in place of the icon
  busy: {
    type: Boolean,
    default: false
  },
  busyMessage: {
    type: String,
    default: 'Searching'
  }
})

const query = defineModel({ type: String, required: true })
</script>

<template>
  <div class="fd-list-search">
    <input v-model="query" class="fd-list-search-input" type="text" :placeholder="placeholder" :aria-label="label"
      autocomplete="off" />
    <FdLoadingDots v-if="busy" size="inline" :message="busyMessage" class="text-secondary fd-list-search-busy" />
    <span v-else class="fd-list-search-icon" aria-hidden="true">
      <FdIcon name="search" />
    </span>
  </div>
</template>
