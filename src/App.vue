<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { user, logout } from './mock/session.js'
import FdLogo from './components/FdLogo.vue'
import FdIcon from './components/FdIcon.vue'
import FdFooter from './components/FdFooter.vue'

const ENTRY_CHOICE_KEY = 'fastdeal-entry-choice'

const route = useRoute()
const router = useRouter()

// A guest who taps Wishlist or Sleep lands on /login?next=..., so keep the tapped icon highlighted.
const loginFor = computed(function () {
  return route.path === '/login' && typeof route.query.next === 'string' ? route.query.next : ''
})

function isNavActive(path) {
  if (path === '/login') {
    return route.path === '/login' && !loginFor.value
  }
  return route.path === path || loginFor.value === path
}
const showEntryDialog = ref(false)
const entryDialog = ref(null)
const loginButton = ref(null)

// Pages where the welcome prompt never shows: the person is already logging in or signing up.
const NO_ENTRY_PROMPT = ['/login', '/signup']

// Ask first-time visitors to log in or continue as a guest, on whichever page they land on.
function maybeShowEntryDialog() {
  if (NO_ENTRY_PROMPT.includes(route.path) || user.value || localStorage.getItem(ENTRY_CHOICE_KEY)) {
    showEntryDialog.value = false
    return
  }
  showEntryDialog.value = true
  focusEntryControl(loginButton)
}

function focusEntryControl(control) {
  nextTick(() => control.value?.focus())
}

function openEntryLogin() {
  localStorage.setItem(ENTRY_CHOICE_KEY, 'login')
  showEntryDialog.value = false
  // Come back to the page they landed on once they have logged in.
  const next = route.path === '/' ? {} : { next: route.fullPath }
  router.push({ path: '/login', query: next })
}

function chooseGuest() {
  localStorage.setItem(ENTRY_CHOICE_KEY, 'guest')
  showEntryDialog.value = false
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

// Keep --fd-nav-height equal to the real navbar height, so each page can fill exactly one screen below it.
const navBar = ref(null)
let navObserver = null

function syncNavHeight() {
  if (navBar.value) {
    document.documentElement.style.setProperty('--fd-nav-height', navBar.value.offsetHeight + 'px')
  }
}

onMounted(() => {
  syncNavHeight()
  navObserver = new ResizeObserver(syncNavHeight)
  navObserver.observe(navBar.value)
})

onBeforeUnmount(() => navObserver?.disconnect())

// Wait for the first route to resolve, otherwise every page looks like '/' on load.
onMounted(() => router.isReady().then(maybeShowEntryDialog))
watch([() => route.path, user], maybeShowEntryDialog)
</script>

<template>
  <nav ref="navBar" class="navbar navbar-expand-lg navbar-dark fd-nav sticky-top">
    <div class="container">
      <router-link class="navbar-brand" to="/" aria-label="FastDeal home"><FdLogo /></router-link>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#fdNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="fdNav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <router-link class="nav-link" to="/search" exact-active-class="active">Search</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/trending" exact-active-class="active">Trending</router-link>
          </li>
        </ul>
        <ul class="navbar-nav align-items-lg-center fd-nav-right">
          <li class="nav-item">
            <router-link class="nav-link fd-icon-link" :class="{ active: isNavActive('/wishlist') }" active-class="" exact-active-class="" to="/wishlist" title="Wishlist">
              <FdIcon name="basket" />
              <span class="fd-icon-label">Wishlist</span>
            </router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link fd-icon-link" :class="{ active: isNavActive('/sleep') }" active-class="" exact-active-class="" to="/sleep" title="Sleep on it">
              <FdIcon name="moon" />
              <span class="fd-icon-label">Sleep</span>
            </router-link>
          </li>
          <li v-if="user" class="nav-item">
            <span class="fd-nav-email small">{{ user.email }}</span>
          </li>
          <li class="nav-item">
            <router-link v-if="!user" class="nav-link fd-icon-link" :class="{ active: isNavActive('/login') }" active-class="" exact-active-class="" to="/login" title="Log in">
              <FdIcon name="account" />
              <span class="fd-icon-label">Log in</span>
            </router-link>
            <button v-else class="nav-link fd-icon-link" type="button" title="Log out" @click="onLogout">
              <FdIcon name="logout" />
              <span class="fd-icon-label">Log out</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </nav>
  <main class="fd-main" :class="{ 'container py-4': !route.meta.fullBleed }">
    <router-view :key="$route.fullPath" />
  </main>
  <FdFooter />
  <div v-if="showEntryDialog" class="fd-entry-backdrop">
    <section
      ref="entryDialog"
      class="fd-entry-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fd-entry-title"
      @keydown="trapEntryFocus"
    >
      <p class="fd-entry-eyebrow">Welcome to FastDeal</p>
      <h1 id="fd-entry-title" class="fd-page-title">How would you like to continue?</h1>
      <p class="fd-entry-description fd-page-subtitle">
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
    </section>
  </div>
</template>
