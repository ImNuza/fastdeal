<script setup>
import { useAuthStore } from '../store/auth.js'
import { storeToRefs } from 'pinia'
const { user } = storeToRefs(useAuthStore())
</script>

<template>
  <div>
    <h1 class="fd-page-title">Admin Dashboard</h1>
    <p class="fd-page-subtitle">Welcome, {{ user?.username || 'admin' }}. This area is for admins only.</p>
  </div>
</template>
