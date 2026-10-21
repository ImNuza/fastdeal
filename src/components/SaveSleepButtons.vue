<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  cancelSleep,
  isAsleep,
  isSaved,
  removeSaved,
  saveProduct,
  savedFrom,
  sleepEndsAt,
  sleepOn,
  user
} from '../mock/session.js'

// Save and Sleep on it buttons for one product, each with an undo.
// Used on the compare page and the product page.
const props = defineProps({
  // Product name, as the wishlist stores it
  name: {
    type: String,
    required: true
  },
  // Optional { store, price } to save from. Without it, the cheapest store is used.
  listing: {
    type: Object,
    default: null
  }
})

const route = useRoute()
const router = useRouter()
const note = ref('')
const now = ref(Date.now())
let clock = 0

onMounted(function () {
  clock = window.setInterval(function () {
    now.value = Date.now()
  }, 30000)
})

onBeforeUnmount(function () {
  window.clearInterval(clock)
})

const saved = computed(function () {
  return isSaved(props.name)
})

const asleep = computed(function () {
  return isAsleep(props.name, now.value)
})

// "23h 12m left", the same format as the wishlist page
const leftText = computed(function () {
  const ms = sleepEndsAt(props.name) - now.value
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.max(Math.floor((ms % 3600000) / 60000), 1)
  if (days > 0) {
    return days + 'd ' + hours + 'h left'
  }
  return hours > 0 ? hours + 'h ' + minutes + 'm left' : minutes + 'm left'
})

function loginNext() {
  router.push({ path: '/login', query: { next: route.fullPath } })
}

function onSave() {
  if (!user.value) {
    loginNext()
    return
  }
  saveProduct(props.name, props.listing || undefined)
  note.value = 'Saved to wishlist from ' + savedFrom(props.name) + '.'
}

function onRemove() {
  if (asleep.value && !window.confirm('This also cancels Sleep on it. Remove it from your wishlist?')) {
    return
  }
  removeSaved(props.name)
  note.value = 'Removed from wishlist.'
}

function onSleep() {
  if (!user.value) {
    loginNext()
    return
  }
  // Save from the real store first. sleepOn on its own would pick a store from the mock catalog.
  if (!saved.value) {
    saveProduct(props.name, props.listing || undefined)
  }
  // The start price lets the wishlist verdict and the "Sleep On It completed" notification compare prices later.
  sleepOn(props.name, 24, props.listing ? props.listing.price : undefined)
  note.value = 'Saved to wishlist and on hold for 1 day.'
}

function onCancelSleep() {
  cancelSleep(props.name)
  note.value = 'Hold cancelled. Still in your wishlist.'
}
</script>

<template>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
    <template v-if="saved">
      <button class="btn btn-dark" type="button" disabled>Saved</button>
      <button class="btn btn-link btn-sm px-1" type="button" :aria-label="'Remove ' + name + ' from wishlist'"
        @click="onRemove">Remove</button>
    </template>
    <button v-else class="btn btn-dark" type="button" @click="onSave">Save</button>

    <template v-if="asleep">
      <button class="btn btn-outline-dark" type="button" disabled>On hold, {{ leftText }}</button>
      <button class="btn btn-link btn-sm px-1" type="button" :aria-label="'Cancel the hold on ' + name"
        @click="onCancelSleep">Cancel hold</button>
    </template>
    <button v-else class="btn btn-outline-dark" type="button" @click="onSleep">Sleep on it</button>

    <span v-if="note" class="small" role="status">{{ note }}</span>
    <span v-if="!user" class="small text-secondary">Log in to save or hold this product.</span>
  </div>
</template>
