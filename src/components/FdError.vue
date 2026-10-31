<script setup>
import { useRouter } from 'vue-router'

// One error layout for the whole app. Pass a code and a message; everything else stays the same.
defineProps({
  code: { type: [String, Number], default: 'Error' },
  title: { type: String, default: 'Something went wrong' },
  message: { type: String, default: 'Please try again in a moment.' },
  // Shows a Try again button that reloads the page, for errors like a failed load.
  retry: { type: Boolean, default: false }
})

const router = useRouter()
</script>

<template>
  <div class="fd-error">
    <p class="fd-error-code">{{ code }}</p>
    <h1 class="fd-page-title">{{ title }}</h1>
    <p class="fd-page-subtitle fd-error-message">{{ message }}</p>
    <div class="fd-error-actions">
      <button v-if="retry" class="btn btn-dark fd-btn-lg" type="button" @click="router.go(0)">Try again</button>
      <router-link class="btn btn-outline-dark fd-btn-lg" to="/">Back to Home</router-link>
    </div>
  </div>
</template>

<style scoped>
.fd-error {
  max-width: 36rem;
  margin: 3rem auto;
  text-align: center;
}
.fd-error-code {
  font-family: var(--fd-font-display);
  font-size: 6rem;
  line-height: 1;
  color: var(--fd-blue);
  padding: 2rem;
  margin-bottom: 1rem;
}
.fd-error-message {
  color: var(--fd-text-muted);
  margin-bottom: 2rem;
}
.fd-error-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}
</style>
