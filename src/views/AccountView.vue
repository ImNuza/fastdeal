<script setup>
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { toggleEmail, user, authReady } from '../mock/session.js'
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

    <section class="mt-4">
      <h2 class="fd-section-title">Settings</h2>
      <div class="card p-3">
        <div class="form-check form-switch mb-0">
          <input id="emailOn" class="form-check-input" type="checkbox" :checked="user.emailOn" @change="toggleEmail" />
          <label class="form-check-label" for="emailOn">Email me when a saved price drops</label>
        </div>
      </div>
    </section>

    <button class="btn btn-dark fd-btn-lg mt-4" type="button" @click="onLogout">Log out</button>
  </div>
</template>
