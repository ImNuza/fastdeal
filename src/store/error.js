import { defineStore } from 'pinia'
import { ref } from 'vue'

// The error shown in place of the current page. App.vue swaps the page for FdError while this is
// set, and clears it when the person goes to another page. The address stays the same, so
// Try again reloads the page that failed.
export const useErrorStore = defineStore('error', () => {
  // { code, message } or null. message is optional: without it, the default text for the code shows.
  const error = ref(null)

  function showError(code, message) {
    error.value = { code: code, message: message || '' }
  }

  function clearError() {
    error.value = null
  }

  return { error, showError, clearError }
})
