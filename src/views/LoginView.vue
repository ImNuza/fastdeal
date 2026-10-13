<script setup>
import { nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resetPassword, signInWithGoogle, signInWithEmail } from '../services/auth.js'

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

// Forgot password: a pop-up on this page that emails a reset link.
const showReset = ref(false)
const resetEmail = ref('')
const resetError = ref('')
const resetSuccess = ref('')
const resetLoading = ref(false)
const resetInput = ref(null)
const forgotLink = ref(null)

function openReset() {
  resetEmail.value = email.value
  resetError.value = ''
  resetSuccess.value = ''
  showReset.value = true
  nextTick(() => resetInput.value?.focus())
}

function closeReset() {
  showReset.value = false
  nextTick(() => forgotLink.value?.focus())
}

async function onResetSubmit() {
  resetError.value = ''
  resetSuccess.value = ''
  if (!resetEmail.value) {
    resetError.value = 'Enter your email address.'
    return
  }
  resetLoading.value = true
  try {
    await resetPassword(resetEmail.value)
    resetSuccess.value = 'Reset link sent. Check your inbox.'
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      resetError.value = 'No account found with that email.'
    } else {
      resetError.value = err.message || 'Something went wrong. Try again.'
    }
  } finally {
    resetLoading.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <h1 class="fd-page-title">Log in</h1>
      <p class="fd-page-subtitle">Log in to save products to your wishlist, get alerts when prices drop, and see what your friends are eyeing!</p>

      <div class="card p-4">
        <p v-if="errorText" class="alert alert-danger mb-3">{{ errorText }}</p>

        <!-- Email + Password first -->
        <form @submit.prevent="onEmailSignIn">
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
            class="form-control login-input mb-1"
            type="password"
            placeholder="Password"
            autocomplete="current-password"
          />
          <div class="text-end mb-3">
            <button ref="forgotLink" class="btn btn-link p-0 forgot-link" type="button" @click="openReset">Forgot password?</button>
          </div>
          <button class="btn btn-dark fd-btn-lg w-100 mb-4" type="submit" :disabled="loading">
            {{ loading ? 'Signing in…' : 'Log in' }}
          </button>
        </form>

        <!-- Divider -->
        <div class="d-flex align-items-center mb-3 gap-2">
          <hr class="flex-grow-1 m-0" />
          <span class="small text-secondary">Or log in with</span>
          <hr class="flex-grow-1 m-0" />
        </div>

        <!-- Google only -->
        <button
          class="btn btn-outline-dark fd-btn-lg w-100 gap-2"
          type="button"
          :disabled="loading"
          @click="onGoogleSignIn"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.6-8 19.6-20 0-1.3-.1-2.7-.4-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.3l-6.6 4.9C9.5 39.5 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.6-2.7 4.7-5 6.1l6.2 5.2C40.3 36.2 44 30.6 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          {{ loading ? 'Signing in…' : 'Continue with Google' }}
        </button>

        <p class="fd-entry-signup">
          New to FastDeal?
          <router-link :to="{ path: '/signup', query: route.query }">Create an account</router-link>
        </p>
      </div>
    </div>
  </div>

  <!-- Forgot password pop-up. Uses the welcome prompt's dialog styles from app.css. -->
  <div v-if="showReset" class="fd-entry-backdrop" @click.self="closeReset" @keydown.esc="closeReset">
    <section class="fd-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-reset-title">
      <h2 id="fd-reset-title" class="fd-page-title">Forgot password</h2>
      <p class="fd-entry-description">Enter your email and we'll send you a link to reset your password.</p>

      <form @submit.prevent="onResetSubmit">
        <p v-if="resetError" class="alert alert-danger mb-3">{{ resetError }}</p>
        <p v-if="resetSuccess" class="alert alert-success mb-3">{{ resetSuccess }}</p>

        <label class="visually-hidden" for="reset-email">Email</label>
        <input
          id="reset-email"
          ref="resetInput"
          v-model="resetEmail"
          class="form-control login-input mb-3"
          type="email"
          placeholder="Email"
          autocomplete="email"
        />
        <div class="fd-entry-actions">
          <button class="btn btn-dark fd-btn-lg" type="submit" :disabled="resetLoading">
            {{ resetLoading ? 'Sending…' : 'Send reset link' }}
          </button>
          <button class="btn btn-outline-dark fd-btn-lg" type="button" @click="closeReset">
            {{ resetSuccess ? 'Done' : 'Cancel' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.login-input {
  /* Pill inputs; colours, border, and focus ring come from the shared .form-control styles. */
  border-radius: 999px;
  padding: 0.75rem 1.25rem;
}

.forgot-link {
  color: var(--fd-blue);
  font-size: var(--fd-small);
  text-decoration: none;
  font-weight: 500;
  vertical-align: baseline;
}

.forgot-link:hover {
  text-decoration: underline;
}
</style>
