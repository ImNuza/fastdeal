<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { user, logout, login as authenticate } from './mock/session.js'

const ENTRY_CHOICE_KEY = 'fastdeal-entry-choice'

const route = useRoute()
const router = useRouter()
const showEntryDialog = ref(false)
const entryStep = ref('choice')
const email = ref('')
const password = ref('')
const loginError = ref('')
const entryDialog = ref(null)
const loginButton = ref(null)
const emailInput = ref(null)

function maybeShowEntryDialog() {
  if (route.path !== '/' || user.value || localStorage.getItem(ENTRY_CHOICE_KEY)) {
    return
  }
  showEntryDialog.value = true
  focusEntryControl(loginButton)
}

function focusEntryControl(control) {
  nextTick(() => control.value?.focus())
}

function openEntryLogin() {
  entryStep.value = 'login'
  loginError.value = ''
  focusEntryControl(emailInput)
}

function backToEntryChoice() {
  entryStep.value = 'choice'
  loginError.value = ''
  focusEntryControl(loginButton)
}

function chooseGuest() {
  localStorage.setItem(ENTRY_CHOICE_KEY, 'guest')
  showEntryDialog.value = false
}

function submitEntryLogin() {
  loginError.value = authenticate(email.value, password.value)
  if (!loginError.value) {
    localStorage.setItem(ENTRY_CHOICE_KEY, 'login')
    showEntryDialog.value = false
  }
}

function trapEntryFocus(event) {
  if (event.key !== 'Tab') {
    return
  }
  const controls = entryDialog.value?.querySelectorAll(
    'button:not(:disabled), input:not(:disabled), a[href]'
  )
  if (!controls?.length) {
    return
  }
  const firstControl = controls[0]
  const lastControl = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === firstControl) {
    event.preventDefault()
    lastControl.focus()
  } else if (!event.shiftKey && document.activeElement === lastControl) {
    event.preventDefault()
    firstControl.focus()
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
      ref="entryDialog"
      class="fd-entry-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fd-entry-title"
      @keydown="trapEntryFocus"
    >
      <template v-if="entryStep === 'choice'">
        <p class="fd-entry-eyebrow">Welcome to FastDeal</p>
        <h1 id="fd-entry-title">How would you like to continue?</h1>
        <p class="fd-entry-description">
          Search and compare as a guest, or log in to save products and set price alerts.
        </p>
        <div class="fd-entry-actions">
          <button
            ref="loginButton"
            class="btn fd-entry-login"
            type="button"
            @click="openEntryLogin"
          >Log in</button>
          <button
            class="btn fd-entry-guest"
            type="button"
            @click="chooseGuest"
          >Continue as guest</button>
        </div>
      </template>
      <template v-else>
        <button class="fd-entry-back" type="button" @click="backToEntryChoice">
          Back
        </button>
        <p class="fd-entry-eyebrow">Welcome back</p>
        <h1 id="fd-entry-title">Log in to FastDeal</h1>
        <p class="fd-entry-description">
          Log in to save products and set price alerts.
        </p>
        <form class="fd-entry-form" @submit.prevent="submitEntryLogin">
          <p v-if="loginError" class="alert alert-danger" role="alert">{{ loginError }}</p>
          <label for="fd-entry-email">Email</label>
          <input
            id="fd-entry-email"
            ref="emailInput"
            v-model="email"
            type="email"
            autocomplete="email"
            required
          />
          <label for="fd-entry-password">Password</label>
          <input
            id="fd-entry-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
          />
          <button class="btn fd-entry-login" type="submit">Log in</button>
        </form>
      </template>
    </section>
  </div>
</template>
