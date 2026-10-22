<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signInWithGoogle, signUpWithEmail } from '../services/auth.js'
import { createOrGetUser } from '../services/userApi.js'
import { startSignup, endSignup, applyDbUser } from '../mock/session.js'

const route = useRoute()
const router = useRouter()

const username = ref('')
const email = ref('')
const password = ref('')
const telegram = ref('')
const errorText = ref('')
const loading = ref(false)

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/
const TELEGRAM_RE = /^[A-Za-z0-9_]{5,32}$/

// Show a banner if redirected here from the login page because the account wasn't found.
if (route.query.error === 'not-registered') {
  errorText.value = "You don't have an account yet. Sign up below!"
}

// After Google auth: if this is a new user (no username in DB yet), send them to /set-username.
// Returning Google users land on the next page as normal.
async function onGoogleSignUp() {
  errorText.value = ''
  loading.value = true
  startSignup() // tell watchAuthState to skip the DB check — we handle it below
  try {
    const fbUser = await signInWithGoogle()
    const dbUser = await createOrGetUser(fbUser.uid, fbUser.email)
    applyDbUser(dbUser, fbUser) // populate user.value immediately
    if (!dbUser.username) {
      router.push('/set-username')
    } else {
      const next = route.query.next
      router.push(typeof next === 'string' && next.startsWith('/') ? next : '/wishlist')
    }
  } catch (err) {
    errorText.value = err.message || 'Google sign-in failed.'
  } finally {
    endSignup()
    loading.value = false
  }
}

async function onEmailSignUp() {
  errorText.value = ''
  const u = username.value.toLowerCase().trim()
  if (!u || !email.value || !password.value) {
    errorText.value = 'Fill in username, email and password.'
    return
  }
  if (!USERNAME_RE.test(u)) {
    errorText.value = 'Username: 3–20 characters, letters, numbers, _ or . only.'
    return
  }
  if (password.value.length < 6) {
    errorText.value = 'Password must be at least 6 characters.'
    return
  }
  const tg = telegram.value.trim().replace(/^@/, '')
  if (tg && !TELEGRAM_RE.test(tg)) {
    errorText.value = 'Telegram username must be 5–32 characters: letters, numbers or _.'
    return
  }
  loading.value = true
  startSignup()
  try {
    const { updateUser } = await import('../services/userApi.js')
    const fbUser = await signUpWithEmail(email.value, password.value)
    const dbUser = await createOrGetUser(fbUser.uid, fbUser.email, u)
    if (tg) {
      try { await updateUser(fbUser.uid, { telegramUsername: tg }) } catch {}
      dbUser.telegramUsername = tg
    }
    applyDbUser(dbUser, fbUser)
    const next = route.query.next
    router.push(typeof next === 'string' && next.startsWith('/') ? next : '/wishlist')
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      errorText.value = 'That email already has an account.'
    } else if (err.response?.status === 409) {
      errorText.value = 'That username is already taken.'
    } else if (err.code === 'auth/weak-password') {
      errorText.value = 'Password must be at least 6 characters.'
    } else {
      errorText.value = err.message || 'Sign up failed.'
    }
  } finally {
    endSignup()
    loading.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <h1 class="fd-page-title">Sign up</h1>
      <p class="fd-page-subtitle">Sign up to save products to your wishlist, get alerts when prices drop, and see what your friends are eyeing!</p>

      <div class="card p-4">
        <p v-if="errorText" :class="['alert mb-3', route.query.error === 'not-registered' ? 'alert-warning' : 'alert-danger']">{{ errorText }}</p>

        <!-- Username + Email + Password -->
        <form @submit.prevent="onEmailSignUp">
          <input
            id="username"
            v-model="username"
            class="form-control login-input mb-3"
            type="text"
            placeholder="Username (e.g. marvel.t)"
            autocomplete="username"
          />
          <input
            id="email"
            v-model="email"
            class="form-control login-input mb-3"
            type="email"
            placeholder="Email"
            autocomplete="email"
          />
          <input
            id="password"
            v-model="password"
            class="form-control login-input mb-3"
            type="password"
            placeholder="Password (min 6 characters)"
            autocomplete="new-password"
          />
          <div class="input-group mb-1">
            <span class="input-group-text" style="border-radius: 999px 0 0 999px;">@</span>
            <input
              id="telegram"
              v-model="telegram"
              class="form-control login-input-flat"
              type="text"
              placeholder="Telegram username (optional)"
              autocomplete="off"
            />
          </div>
          <p class="small text-secondary mb-3">Shared only with friends who want to Buy Together on the same item.</p>
          <button class="btn btn-dark fd-btn-lg w-100 mb-4" type="submit" :disabled="loading">
            {{ loading ? 'Creating account…' : 'Create account' }}
          </button>
        </form>

        <!-- Divider -->
        <div class="d-flex align-items-center mb-3 gap-2">
          <hr class="flex-grow-1 m-0" />
          <span class="small text-secondary">Or sign up with</span>
          <hr class="flex-grow-1 m-0" />
        </div>

        <!-- Google only -->
        <button
          class="btn btn-outline-dark fd-btn-lg w-100 gap-2"
          type="button"
          :disabled="loading"
          @click="onGoogleSignUp"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.6-8 19.6-20 0-1.3-.1-2.7-.4-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.3l-6.6 4.9C9.5 39.5 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.6-2.7 4.7-5 6.1l6.2 5.2C40.3 36.2 44 30.6 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          {{ loading ? 'Signing up…' : 'Continue with Google' }}
        </button>

        <p class="fd-entry-signup">
          Already have an account?
          <router-link :to="{ path: '/login', query: route.query }">Log in</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-input {
  border-radius: 999px;
  padding: 0.75rem 1.25rem;
}
.login-input-flat {
  border-radius: 0 999px 999px 0;
  padding: 0.75rem 1.25rem;
}
</style>
