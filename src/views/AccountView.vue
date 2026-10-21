<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toggleEmail, user, authReady } from '../mock/session.js'
import { signOutUser } from '../services/auth.js'
import { updateUser } from '../services/userApi.js'

const router = useRouter()

// Wait for Firebase to restore session before redirecting unauthenticated users.
watch(authReady, (ready) => {
  if (ready && !user.value) router.replace('/login?next=/account')
}, { immediate: true })

// Telegram username for Buy Together. Only accepted friends who saved the same product see it.
const telegram = ref('')
const telegramNote = ref('')
const telegramError = ref('')
const savingTelegram = ref(false)

watch(user, function (current) {
  if (current) {
    telegram.value = current.telegramUsername || ''
  }
}, { immediate: true })

async function saveTelegram() {
  telegramNote.value = ''
  telegramError.value = ''
  savingTelegram.value = true
  try {
    const dbUser = await updateUser({ telegramUsername: telegram.value })
    user.value.telegramUsername = dbUser.telegramUsername || ''
    telegram.value = user.value.telegramUsername
    telegramNote.value = dbUser.telegramUsername ? 'Saved.' : 'Removed.'
  } catch (err) {
    telegramError.value = err.response?.data?.error || 'Could not save. Try again.'
  } finally {
    savingTelegram.value = false
  }
}

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

      <form class="card p-3 mt-3" @submit.prevent="saveTelegram">
        <label class="form-label" for="telegram">Telegram username</label>
        <div class="input-group">
          <span class="input-group-text">@</span>
          <input id="telegram" v-model="telegram" class="form-control" type="text" autocomplete="off"
            placeholder="yourname" aria-describedby="telegram-help" />
          <button class="btn btn-dark" type="submit" :disabled="savingTelegram">
            {{ savingTelegram ? 'Saving...' : 'Save' }}</button>
        </div>
        <p id="telegram-help" class="small text-secondary mb-0 mt-1">
          Friends who save the same item can see this, so you can order together and split the shipping.
          Leave it empty to hide it.</p>
        <p v-if="telegramError" class="small text-danger mb-0 mt-1" role="alert">{{ telegramError }}</p>
        <p v-else-if="telegramNote" class="small mb-0 mt-1" role="status">{{ telegramNote }}</p>
      </form>
    </section>

    <button class="btn btn-dark fd-btn-lg mt-4" type="button" @click="onLogout">Log out</button>
  </div>
</template>
