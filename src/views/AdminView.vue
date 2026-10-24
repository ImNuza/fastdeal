<script setup>
import { user } from '../store/auth.js'
</script>

<template>
  <div>
    <h1 class="fd-page-title">Admin Dashboard</h1>
    <p class="fd-page-subtitle">Welcome, {{ user?.username || 'admin' }}. This area is for admins only.</p>
  </div>
</template>
