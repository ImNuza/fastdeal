<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../store/auth.js'
import { useWishlistStore } from '../store/wishlist.js'

// Save to wishlist button for one product. Used on the product page. Sleep on it lives on the
// Wishlist page only. A product already on hold there cannot be removed here either: the hold is
// there to stop an impulse buy, so it runs until the timer ends.
const props = defineProps({
  // Product title, as the wishlist stores it
  name: {
    type: String,
    required: true
  },
  // { store, price } to save from. Without it there is nothing to save.
  listing: {
    type: Object,
    default: null
  },
  // Optional { productId, q, image }, so the wishlist can open this product page again
  product: {
    type: Object,
    default: null
  }
})

const productId = computed(function () {
  return props.product ? props.product.productId : undefined
})

const { user } = storeToRefs(useAuthStore())
const { isAsleep, isSaved, removeSaved, saveProduct, savedFrom } = useWishlistStore()

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
  return isSaved(props.name, productId.value)
})

const asleep = computed(function () {
  return isAsleep(props.name, now.value, productId.value)
})

function loginNext() {
  router.push({ path: '/login', query: { next: route.fullPath } })
}

function onSave() {
  if (!user.value) {
    loginNext()
    return
  }
  saveProduct(props.name, props.listing, props.product)
  note.value = 'Saved to wishlist from ' + savedFrom(props.name, productId.value) + '.'
}

function onRemove() {
  removeSaved(props.name, productId.value)
  note.value = 'Removed from wishlist.'
}

</script>

<template>
  <!-- Top-aligned, so the buttons stay level when Remove sits under Saved to wishlist. -->
  <div class="d-flex flex-wrap align-items-start gap-2">
    <!-- Saved: the button with Remove centred underneath it. -->
    <div v-if="saved" class="d-flex flex-column align-items-center">
      <button class="btn btn-dark" type="button" disabled>Saved to wishlist</button>
      <!-- No Remove while on hold, or removing and saving again would skip the hold. -->
      <button v-if="!asleep" class="btn btn-link btn-sm px-1" type="button"
        :aria-label="'Remove ' + name + ' from wishlist'" @click="onRemove">Remove</button>
    </div>
    <button v-else class="btn btn-dark" type="button" :disabled="!listing" @click="onSave">Save to wishlist</button>

    <!-- Any extra buttons from the page, such as Go to store, sit after Save and before the notes. -->
    <slot />

    <span v-if="note" class="small align-self-center" role="status">{{ note }}</span>
    <span v-if="!user" class="small text-secondary align-self-center">Log in to save this product.</span>
  </div>
</template>
