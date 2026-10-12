<script setup>
import { ref } from 'vue'
import { resetPassword } from '../services/auth.js'

const email = ref('')
const errorText = ref('')
const successText = ref('')
const loading = ref(false)

async function onSubmit() {
  errorText.value = ''
  successText.value = ''
  if (!email.value) {
    errorText.value = 'Enter your email address.'
    return
  }
  loading.value = true
  try {
    await resetPassword(email.value)
    successText.value = 'Password reset email sent. Check your inbox.'
    email.value = ''
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      errorText.value = 'No account found with that email.'
    } else {
      errorText.value = err.message || 'Something went wrong. Try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <h1 class="fd-page-title">Forgot password</h1>
      <p class="fd-page-subtitle">We'll send a reset link to your email address.</p>

      <form class="card p-3" @submit.prevent="onSubmit">
        <p v-if="errorText" class="alert alert-danger">{{ errorText }}</p>
        <p v-if="successText" class="alert alert-success">{{ successText }}</p>

        <label class="form-label" for="email">Email</label>
        <input id="email" v-model="email" class="form-control mb-3" type="email" autocomplete="email" />
        <button class="btn btn-dark w-100" type="submit" :disabled="loading">
          {{ loading ? 'Sending…' : 'Send reset link' }}
        </button>

        <p class="small mt-3 mb-0">
          Remembered it?
          <router-link to="/login">Back to log in</router-link>
        </p>
      </form>
    </div>
  </div>
</template>
