<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signInWithGoogle, signInWithEmail } from '../services/auth.js'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const errorText = ref('')
const loading = ref(false)

function goNext() {
  const next = route.query.next
  if (typeof next === 'string' && next.startsWith('/')) {
    router.push(next)
  } else {
    router.push('/')
  }
}

async function onGoogleSignIn() {
  errorText.value = ''
  loading.value = true
  try {
    await signInWithGoogle()
    goNext()
  } catch (err) {
    errorText.value = err.message || 'Google sign-in failed.'
  } finally {
    loading.value = false
  }
}

async function onEmailSignIn() {
  errorText.value = ''
  if (!email.value || !password.value) {
    errorText.value = 'Enter your email and password.'
    return
  }
  loading.value = true
  try {
    await signInWithEmail(email.value, password.value)
    goNext()
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      errorText.value = 'Email or password is wrong.'
    } else {
      errorText.value = err.message || 'Login failed.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <h1 class="fd-page-title">Log in</h1>
      <p class="fd-page-subtitle">Search works without an account. Save, alerts, and Sleep on it need a login.</p>

      <div class="card p-3">
        <p v-if="errorText" class="alert alert-danger mb-3">{{ errorText }}</p>

        <!-- Google Sign-In -->
        <button
          class="btn btn-dark w-100 d-flex align-items-center justify-content-center gap-2"
          type="button"
          :disabled="loading"
          @click="onGoogleSignIn"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.6-8 19.6-20 0-1.3-.1-2.7-.4-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.3l-6.6 4.9C9.5 39.5 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.6-2.7 4.7-5 6.1l6.2 5.2C40.3 36.2 44 30.6 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          {{ loading ? 'Signing in…' : 'Continue with Google' }}
        </button>

        <div class="d-flex align-items-center my-3 gap-2">
          <hr class="flex-grow-1 m-0" />
          <span class="small text-secondary">or</span>
          <hr class="flex-grow-1 m-0" />
        </div>

        <!-- Email + Password -->
        <form @submit.prevent="onEmailSignIn">
          <label class="form-label" for="email">Email</label>
          <input id="email" v-model="email" class="form-control mb-3" type="email" autocomplete="email" />
          <label class="form-label" for="password">Password</label>
          <input id="password" v-model="password" class="form-control mb-1" type="password" autocomplete="current-password" />
          <div class="text-end mb-3">
            <router-link class="small" to="/forgot-password">Forgot password?</router-link>
          </div>
          <button class="btn btn-outline-dark w-100" type="submit" :disabled="loading">
            {{ loading ? 'Signing in…' : 'Log in with email' }}
          </button>
        </form>

        <p class="small mt-3 mb-0">
          No account?
          <router-link :to="{ path: '/signup', query: route.query }">Sign up</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
