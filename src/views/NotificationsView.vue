<script setup>
import { useRouter } from 'vue-router'
import { user } from '../mock/session.js'

const router = useRouter()

if (!user.value) {
  router.replace('/login?next=/notifications')
}
</script>

<template>
  <div v-if="user">
    <h1 class="fd-page-title">Notifications</h1>
  </div>
</template>
