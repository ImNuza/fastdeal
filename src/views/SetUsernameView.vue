<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { firebaseUser, user } from '../mock/session.js'
import { updateUser } from '../services/userApi.js'

const router = useRouter()

const username = ref('')
const errorText = ref('')
const loading = ref(false)

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/

async function onSubmit() {
  errorText.value = ''
  const u = username.value.toLowerCase().trim()
  if (!u) {
    errorText.value = 'Enter a username.'
    return
  }
  if (!USERNAME_RE.test(u)) {
    errorText.value = 'Username: 3–20 characters, letters, numbers, _ or . only.'
    return
  }
  if (!firebaseUser.value) {
    errorText.value = 'You must be logged in.'
    return
  }
  loading.value = true
  try {
    // Save username in MongoDB via PUT /api/users/me
    const dbUser = await updateUser({ username: u })
    console.log('[SetUsername] saved:', dbUser)
    // Update local session so the navbar shows it immediately
    if (user.value) user.value.username = dbUser.username
    router.push('/wishlist')
  } catch (err) {
    if (err.response?.status === 409) {
      errorText.value = 'That username is already taken. Try another.'
    } else if (err.response?.status === 400) {
      errorText.value = err.response.data?.error || 'Invalid username.'
    } else {
      errorText.value = err.message || 'Something went wrong.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <h1 class="fd-page-title">Pick a username</h1>
      <p class="fd-page-subtitle">Friends find you by username. You can change it later in Account settings.</p>

      <div class="card p-4">
        <p v-if="errorText" class="alert alert-danger mb-3">{{ errorText }}</p>

        <form @submit.prevent="onSubmit">
          <input
            id="username"
            v-model="username"
            class="form-control login-input mb-1"
            type="text"
            placeholder="e.g. marvel.t"
            autocomplete="username"
            autofocus
          />
          <p class="small text-secondary mb-3">3–20 characters. Letters, numbers, _ and . only.</p>
          <button class="btn btn-dark fd-btn-lg w-100" type="submit" :disabled="loading">
            {{ loading ? 'Saving…' : 'Set username' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-input {
  border-radius: 999px;
  padding: 0.75rem 1.25rem;
}
</style>
