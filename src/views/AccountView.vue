<script setup>
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { user, authReady } from '../mock/session.js'
import { signOutUser } from '../services/auth.js'

const router = useRouter()

// Wait for Firebase to restore session before redirecting unauthenticated users.
watch(authReady, (ready) => {
  if (ready && !user.value) router.replace('/login?next=/account')
}, { immediate: true })

async function onLogout() {
  await signOutUser()
  router.push('/')
}
</script>

<template>
  <div v-if="user">
    <h1 class="fd-page-title">Account</h1>
    <button class="btn btn-dark fd-btn-lg mt-3" type="button" @click="onLogout">Log out</button>
  </div>
</template>
