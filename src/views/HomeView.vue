<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { catalog, nameFromFile } from '../mock/catalog.js'

const router = useRouter()
const query = ref('')
const photoName = ref('')

function go(name) {
  const q = String(name || '').trim()
  if (!q) {
    return
  }
  router.push({ path: '/compare', query: { q: q } })
}

function onSearch() {
  go(query.value)
}

function onPhoto(event) {
  const file = event.target.files[0]
  if (!file) {
    return
  }
  const name = nameFromFile(file.name)
  photoName.value = name
  router.push({ path: '/compare', query: { q: name, from: 'photo' } })
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-lg-8">
      <h1 class="h2 mb-2">Compare the price before you buy</h1>
      <p class="text-secondary mb-4">Type a product name, or upload a photo. FastDeal shows store listings on one page and marks the cheapest.</p>

      <form class="card p-3 mb-3" @submit.prevent="onSearch">
        <label class="form-label" for="q">Product name</label>
        <div class="input-group mb-3">
          <input id="q" v-model="query" class="form-control" type="text" placeholder="Sony WH-1000XM5" />
          <button class="btn btn-dark" type="submit">Search</button>
        </div>
        <label class="form-label" for="photo">Product photo</label>
        <input id="photo" class="form-control" type="file" accept="image/*" @change="onPhoto" />
        <p v-if="photoName" class="small text-secondary mt-2 mb-0">Identified as {{ photoName }}</p>
      </form>

      <p class="small text-secondary mb-2">Try a saved product</p>
      <div class="d-flex flex-wrap gap-2 mb-4">
        <button
          v-for="item in catalog"
          :key="item.name"
          class="btn btn-outline-dark btn-sm"
          type="button"
          @click="go(item.name)"
        >{{ item.name }}</button>
      </div>

      <div class="row g-3">
        <div class="col-md-4">
          <div class="card h-100 p-3">
            <h2 class="h6">One table</h2>
            <p class="small mb-0">Price, store, rating, and review count. The cheapest row has a badge.</p>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card h-100 p-3">
            <h2 class="h6">Worth It?</h2>
            <p class="small mb-0">A short note says Worth It, Maybe, or Not Worth It, and whether to buy now or wait.</p>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card h-100 p-3">
            <h2 class="h6">Save or wait</h2>
            <p class="small mb-0">Log in to save a product, set a target price, or hold it for 24 hours.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
