<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { cheapestPrice, sgd } from '../mock/catalog.js'
import { removeSleep, saveProduct, user } from '../mock/session.js'

const router = useRouter()
const now = ref(Date.now())

if (!user.value) {
  router.replace('/login?next=/sleep')
}

onMounted(function () {
  now.value = Date.now()
})

function ended(item) {
  return item.endsAt <= now.value
}

function leftText(item) {
  const ms = item.endsAt - now.value
  if (ms <= 0) {
    return 'Hold ended'
  }
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return hours + 'h ' + minutes + 'm left'
}

function keep(item) {
  saveProduct({ name: item.name, savedPrice: cheapestPrice(item.name) })
  removeSleep(item.name)
}
</script>

<template>
  <div v-if="user">
    <h1 class="fd-page-title">Sleep on it</h1>
    <p class="fd-page-subtitle">A product stays here for 24 hours. When the hold ends, the row shows the latest price so you can decide.</p>

    <p v-if="!user.sleep.length" class="alert alert-secondary">No holds. Open a product and press Sleep on it.</p>

    <div v-else class="row g-3">
      <div v-for="item in user.sleep" :key="item.name" class="col-md-6">
        <div class="card p-3 h-100">
          <h2 class="fd-section-subtitle">
            <router-link :to="{ path: '/compare', query: { q: item.name } }">{{ item.name }}</router-link>
          </h2>
          <p class="mb-1">Latest price {{ sgd(cheapestPrice(item.name)) }}</p>
          <p class="text-secondary">{{ leftText(item) }}</p>
          <p v-if="ended(item)" class="fw-semibold">Still want it?</p>
          <div class="d-flex gap-2">
            <button v-if="ended(item)" class="btn btn-dark btn-sm" type="button" @click="keep(item)">Save to wishlist</button>
            <button class="btn btn-outline-danger btn-sm" type="button" @click="removeSleep(item.name)">Remove</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
