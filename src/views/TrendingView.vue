<script setup>
import { trending } from '../mock/catalog.js'
import { itemName } from '../services/itemName.js'
</script>

<template>
  <h1 class="fd-page-title">Trending</h1>
  <p class="fd-page-subtitle">Anonymised searches on FastDeal. A row opens the same compare table.</p>
  <div class="table-responsive">
    <table class="table table-bordered">
      <thead>
        <tr>
          <th>Product name</th>
          <th>Searches</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in trending" :key="row.query">
          <td>{{ itemName(row.query) }}</td>
          <td>{{ row.count }}</td>
          <td>
            <router-link :to="{ path: '/compare', query: { q: row.query } }">Compare</router-link>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
