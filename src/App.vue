<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { user, logout } from './mock/session.js'

const ENTRY_CHOICE_KEY = 'fastdeal-entry-choice'

const route = useRoute()
const router = useRouter()
const showEntryDialog = ref(false)
const loginButton = ref(null)
const guestButton = ref(null)

function maybeShowEntryDialog() {
  if (route.path !== '/' || user.value || localStorage.getItem(ENTRY_CHOICE_KEY)) {
    return
  }
  showEntryDialog.value = true
  nextTick(() => loginButton.value?.focus())
}

function chooseEntry(choice) {
  localStorage.setItem(ENTRY_CHOICE_KEY, choice)
  showEntryDialog.value = false
  if (choice === 'login') {
    router.push('/login')
  }
}

function trapEntryFocus(event) {
  if (event.key !== 'Tab') {
    return
  }
  if (event.shiftKey && document.activeElement === loginButton.value) {
    event.preventDefault()
    guestButton.value?.focus()
  } else if (!event.shiftKey && document.activeElement === guestButton.value) {
    event.preventDefault()
    loginButton.value?.focus()
  }
}

function onLogout() {
  logout()
  router.push('/')
}

onMounted(maybeShowEntryDialog)
watch([() => route.path, user], maybeShowEntryDialog)
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-dark fd-nav">
    <div class="container">
      <router-link class="navbar-brand" to="/">FastDeal</router-link>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#fdNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="fdNav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <router-link class="nav-link" to="/" exact-active-class="active">Search</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/trending" exact-active-class="active">Trending</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/wishlist" exact-active-class="active">Wishlist</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/sleep" exact-active-class="active">Sleep</router-link>
          </li>
        </ul>
        <div class="d-flex align-items-center gap-2 py-2 py-lg-0">
          <span v-if="user" class="text-white-50 small">{{ user.email }}</span>
          <router-link v-if="!user" class="btn btn-sm btn-outline-light" to="/login">Log in</router-link>
          <button v-else class="btn btn-sm btn-outline-light" type="button" @click="onLogout">Log out</button>
        </div>
      </div>
    </div>
  </nav>
  <main class="container py-4">
    <router-view :key="$route.fullPath" />
  </main>
  <div v-if="showEntryDialog" class="fd-entry-backdrop">
    <section
      class="fd-entry-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fd-entry-title"
      aria-describedby="fd-entry-description"
      @keydown="trapEntryFocus"
    >
      <p class="fd-entry-eyebrow">Welcome to FastDeal</p>
      <h1 id="fd-entry-title">How would you like to continue?</h1>
      <p id="fd-entry-description" class="fd-entry-description">
        Search and compare as a guest, or log in to save products and set price alerts.
      </p>
      <div class="fd-entry-actions">
        <button
          ref="loginButton"
          class="btn fd-entry-login"
          type="button"
          @click="chooseEntry('login')"
        >Log in</button>
        <button
          ref="guestButton"
          class="btn fd-entry-guest"
          type="button"
          @click="chooseEntry('guest')"
        >Continue as guest</button>
      </div>
    </section>
  </div>
</template>
