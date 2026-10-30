<script setup>
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useTrendingStore } from '../store/trending.js'
import { itemName } from '../services/itemName.js'

const trendingStore = useTrendingStore()
const { week, error } = storeToRefs(trendingStore)

onMounted(trendingStore.fetchTrending)

function nameOf(row) {
  return row.query || row._id
}
</script>

<template>
  <h1 class="fd-page-title">Trending</h1>
  <p class="fd-page-subtitle">What people are searching for on FastDeal this week. Tap a row to compare prices.</p>
  <p v-if="error" class="alert alert-danger">{{ error }}</p>
  <p v-else-if="!week.length" class="alert alert-secondary">Nothing has been searched yet this week.</p>
  <div v-else class="table-responsive">
    <table class="table table-bordered">
      <thead>
        <tr>
          <th>Product name</th>
          <th>Searches</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in week" :key="row._id">
          <td>{{ itemName(nameOf(row)) }}</td>
          <td>{{ row.count }}</td>
          <td>
            <router-link :to="{ path: '/compare', query: { q: nameOf(row) } }">Compare</router-link>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
