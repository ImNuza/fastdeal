<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signInWithGoogle, signUpWithEmail } from '../services/auth.js'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const errorText = ref('')
const loading = ref(false)

function goNext() {
  const next = route.query.next
  router.push(typeof next === 'string' && next.startsWith('/') ? next : '/wishlist')
}

async function onGoogleSignUp() {
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

async function onEmailSignUp() {
  errorText.value = ''
  if (!email.value || !password.value) {
    errorText.value = 'Enter an email and a password.'
    return
  }
  if (password.value.length < 6) {
    errorText.value = 'Use at least 6 characters.'
    return
  }
  loading.value = true
  try {
    await signUpWithEmail(email.value, password.value)
    goNext()
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      errorText.value = 'That email already has an account.'
    } else if (err.code === 'auth/weak-password') {
      errorText.value = 'Use at least 6 characters.'
    } else {
      errorText.value = err.message || 'Sign up failed.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <h1 class="fd-page-title">Sign up</h1>
      <p class="fd-page-subtitle">Create an account to save products and set price alerts.</p>

      <div class="card p-4">
        <p v-if="errorText" class="alert alert-danger mb-3">{{ errorText }}</p>

        <!-- Email + Password first -->
        <form @submit.prevent="onEmailSignUp">
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
            placeholder="Password"
            autocomplete="new-password"
          />
          <button class="btn login-btn w-100 mb-4" type="submit" :disabled="loading">
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
          class="btn google-btn w-100 d-flex align-items-center justify-content-center gap-2"
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

        <p class="small text-center mt-4 mb-0">
          Already have an account?
          <router-link :to="{ path: '/login', query: route.query }">Log in</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-input {
  border-radius: 2rem;
  padding: 0.75rem 1.25rem;
  border: 1.5px solid #ddd;
  background: #fff;
}
.login-input:focus {
  border-color: var(--fd-blue);
  box-shadow: none;
}
.login-btn {
  border-radius: 2rem;
  background: #2a7a6f;
  color: #fff;
  font-weight: 600;
  padding: 0.75rem;
  font-size: 1rem;
  border: none;
}
.login-btn:hover:not(:disabled) {
  background: #236059;
  color: #fff;
}
.google-btn {
  border-radius: 0.75rem;
  border: 1.5px solid #ddd;
  background: #fff;
  color: #333;
  font-weight: 500;
  padding: 0.65rem;
}
.google-btn:hover:not(:disabled) {
  background: #f5f5f5;
}
</style>
