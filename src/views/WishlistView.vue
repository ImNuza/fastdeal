<script setup>
import { useRouter } from 'vue-router'
import { cheapestPrice, sgd } from '../mock/catalog.js'
import { removeSaved, setTarget, toggleEmail, user } from '../mock/session.js'

const router = useRouter()

if (!user.value) {
  router.replace('/login?next=/wishlist')
}

function currentPrice(name) {
  return cheapestPrice(name)
}

function dropped(item) {
  const now = currentPrice(item.name)
  return now <= item.savedPrice * 0.9
}

function reached(item) {
  const now = currentPrice(item.name)
  return now <= Number(item.targetPrice)
}

function onTarget(item, event) {
  setTarget(item.name, event.target.value)
}
</script>

<template>
  <div v-if="user">
    <h1 class="h3">Wishlist</h1>
    <p class="text-secondary">Saved price against the current cheapest price. A 10% drop is marked. Your target price is marked when the current price is at or below it.</p>

    <div class="form-check form-switch mb-3">
      <input id="emailOn" class="form-check-input" type="checkbox" :checked="user.emailOn" @change="toggleEmail" />
      <label class="form-check-label" for="emailOn">Email me when a saved price drops</label>
    </div>

    <p v-if="!user.wishlist.length" class="alert alert-secondary">No saved products. Search, then press Save.</p>

    <div v-else class="table-responsive">
      <table class="table table-bordered align-middle">
        <thead>
          <tr>
            <th>Product</th>
            <th>Saved</th>
            <th>Current</th>
            <th>Target</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in user.wishlist" :key="item.name">
            <td>
              <router-link :to="{ path: '/compare', query: { q: item.name } }">{{ item.name }}</router-link>
            </td>
            <td>{{ sgd(item.savedPrice) }}</td>
            <td>{{ sgd(currentPrice(item.name)) }}</td>
            <td style="min-width: 8rem">
              <input class="form-control form-control-sm" type="number" :value="item.targetPrice" @change="onTarget(item, $event)" />
            </td>
            <td>
              <span v-if="dropped(item)" class="badge text-bg-success me-1">Price drop</span>
              <span v-if="reached(item)" class="badge text-bg-dark me-1">Target reached</span>
              <span v-if="!dropped(item) && !reached(item)" class="text-secondary small">No alert</span>
              <p v-if="(dropped(item) || reached(item)) && user.emailOn" class="small mb-0 mt-1">Email sent to {{ user.email }}</p>
              <p v-if="(dropped(item) || reached(item)) && !user.emailOn" class="small mb-0 mt-1">No email. Alerts are off.</p>
            </td>
            <td>
              <button class="btn btn-sm btn-outline-danger" type="button" @click="removeSaved(item.name)">Remove</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
