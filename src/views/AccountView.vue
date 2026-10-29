<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../store/auth.js'
import { signOutUser } from '../services/auth.js'
import { updateUser } from '../services/userApi.js'

const router = useRouter()
const authStore = useAuthStore()
const { user, authReady } = storeToRefs(authStore)
const { toggleEmail } = authStore

watch(authReady, (ready) => {
  if (ready && !user.value) router.replace('/login?next=/account')
}, { immediate: true })

async function onLogout() {
  await signOutUser()
  router.push('/')
}

// Telegram username editing
const telegramInput = ref('')
const telegramError = ref('')
const telegramSuccess = ref(false)
const telegramLoading = ref(false)
const TELEGRAM_RE = /^[A-Za-z0-9_]{5,32}$/

watch(user, (u) => {
  if (u) telegramInput.value = u.telegramUsername || ''
}, { immediate: true })

async function saveTelegram() {
  telegramError.value = ''
  telegramSuccess.value = false
  const handle = telegramInput.value.trim().replace(/^@/, '')
  if (handle && !TELEGRAM_RE.test(handle)) {
    telegramError.value = 'Must be 5–32 characters: letters, numbers or _.'
    return
  }
  telegramLoading.value = true
  try {
    const dbUser = await updateUser({ telegramUsername: handle || null })
    if (user.value) user.value.telegramUsername = dbUser.telegramUsername || null
    telegramSuccess.value = true
    setTimeout(() => { telegramSuccess.value = false }, 2500)
  } catch (err) {
    telegramError.value = err.response?.data?.error || err.message || 'Could not save.'
  } finally {
    telegramLoading.value = false
  }
}
</script>

<template>
  <div v-if="user">
    <h1 class="fd-page-title">Account</h1>

    <section class="mt-4">
      <h2 class="fd-section-title">Settings</h2>
      <div class="card p-3 mb-3">
        <div class="form-check form-switch mb-0">
          <input id="emailOn" class="form-check-input" type="checkbox" :checked="user.emailOn" @change="toggleEmail" />
          <label class="form-check-label" for="emailOn">Email me when a saved price drops</label>
        </div>
      </div>

      <div class="card p-3">
        <label class="form-label fw-semibold mb-1" for="tg-account">Telegram username</label>
        <p class="small text-secondary mb-2">Shared only with friends who want to Buy Together on the same item.</p>
        <div class="input-group mb-2">
          <span class="input-group-text">@</span>
          <input
            id="tg-account"
            v-model="telegramInput"
            class="form-control"
            type="text"
            placeholder="yourtelegram"
            autocomplete="off"
            @keyup.enter="saveTelegram"
          />
          <button class="btn btn-dark" type="button" :disabled="telegramLoading" @click="saveTelegram">
            {{ telegramLoading ? 'Saving…' : 'Save' }}
          </button>
        </div>
        <p v-if="telegramError" class="small text-danger mb-0">{{ telegramError }}</p>
        <p v-if="telegramSuccess" class="small text-success mb-0">Saved!</p>
      </div>
    </section>

    <button class="btn btn-dark fd-btn-lg mt-4" type="button" @click="onLogout">Log out</button>
  </div>
</template>
