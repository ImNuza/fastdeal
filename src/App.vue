<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { user, firebaseUser } from './mock/session.js'

// Computed so the navbar username updates reactively whenever user logs in, out, or sets a username.
const username = computed(() => user.value?.username || '')
import FdLogo from './components/FdLogo.vue'
import FdIcon from './components/FdIcon.vue'
import FdFooter from './components/FdFooter.vue'

// Remembered for this browser session only, so a guest is asked again on their next visit.
const ENTRY_CHOICE_KEY = 'fastdeal-entry-choice'

const route = useRoute()
const router = useRouter()

// A guest who taps a locked icon lands on /login?next=..., so the tapped icon stays yellow, not Log in.
const GATED_PAGES = ['/wishlist', '/friends', '/notifications']
const loginFor = computed(function () {
  const next = route.query.next
  return route.path === '/login' && GATED_PAGES.includes(next) ? next : ''
})

// Exactly one icon is yellow: the page you are on, or the locked page you tapped on its way to log in.
function isNavActive(path) {
  if (path === '/login') {
    return route.path === '/login' && !loginFor.value
  }
  const here = loginFor.value || route.path
  return here === path
}
const showEntryDialog = ref(false)
const entryDialog = ref(null)
const loginButton = ref(null)

// Pages where the welcome prompt never shows: the person is already logging in or signing up.
const NO_ENTRY_PROMPT = ['/login', '/signup']

// Ask first-time visitors to log in or continue as a guest, on whichever page they land on.
function maybeShowEntryDialog() {
  if (NO_ENTRY_PROMPT.includes(route.path) || user.value || sessionStorage.getItem(ENTRY_CHOICE_KEY)) {
    showEntryDialog.value = false
    return
  }
  showEntryDialog.value = true
  focusEntryControl(loginButton)
}

function focusEntryControl(control) {
  nextTick(() => control.value?.focus())
}

// Log in and Sign up both go to an account page, then come back to the page they landed on.
function openAccountPage(path) {
  sessionStorage.setItem(ENTRY_CHOICE_KEY, 'account')
  showEntryDialog.value = false
  router.push({ path: path, query: { next: route.fullPath } })
}

function chooseGuest() {
  sessionStorage.setItem(ENTRY_CHOICE_KEY, 'guest')
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

// Keep --fd-nav-height equal to the real navbar height, so each page can fill exactly one screen below it.
const navBar = ref(null)
let navObserver = null

function syncNavHeight() {
  if (navBar.value) {
    document.documentElement.style.setProperty('--fd-nav-height', navBar.value.offsetHeight + 'px')
  }
}

//notification badge

const unreadCount = ref(0)

async function refreshUnread() {
  if (!firebaseUser.value) {
    unreadCount.value = 0
    return
  }
  try {
    const res = await axios.get('/api/notifications')
    unreadCount.value = res.data.filter(n => !n.read).length
  } catch (err) {
    console.log(err)
  }
}

let timer = 0

onMounted(function () {
  refreshUnread()
  timer = window.setInterval(refreshUnread, 5000)
})

onBeforeUnmount(function () {
  window.clearInterval(timer)
})

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

<style scoped>
.nav-username {
  color: var(--fd-beige);
  font-family: var(--fd-font-body);
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<template>
  <nav ref="navBar" class="navbar navbar-expand-lg navbar-dark fd-nav sticky-top">
    <div class="container">
      <router-link class="navbar-brand" to="/" aria-label="FastDeal home"><FdLogo /></router-link>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#fdNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="fdNav">
        <ul class="navbar-nav ms-auto align-items-lg-center fd-nav-right">
          <li class="nav-item">
            <router-link class="nav-link fd-icon-link" :class="{ active: isNavActive('/friends') }" active-class="" exact-active-class="" to="/friends">
              <FdIcon name="friends" />
              <span class="fd-icon-label">Friends</span>
            </router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link fd-icon-link" :class="{ active: isNavActive('/wishlist') }" active-class="" exact-active-class="" to="/wishlist">
              <FdIcon name="tag" />
              <span class="fd-icon-label">Wishlist</span>
            </router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link fd-icon-link" :class="{ active: isNavActive('/notifications') }" active-class="" exact-active-class="" to="/notifications">
              <FdIcon name="bell" />
              <span class="fd-icon-label">Notifications</span>
              <span v-if="unreadCount" class="badge rounded-pill bg-danger" style="position: absolute; top: 0; right: 0; font-family: var(--fd-font-body);">{{ unreadCount }}</span>
            </router-link>
          </li>
          <li v-if="!user" class="nav-item">
            <router-link class="nav-link fd-icon-link" :class="{ active: isNavActive('/login') }" active-class="" exact-active-class="" to="/login">
              <FdIcon name="account" />
              <span class="fd-icon-label">Account</span>
            </router-link>
          </li>
          <!-- Logged in: show username next to account icon, links to Account page. -->
          <li v-else class="nav-item">
            <router-link class="nav-link fd-icon-link" :class="{ active: isNavActive('/account') }" active-class="" exact-active-class="" to="/account">
              <FdIcon name="account" />
              <span v-if="username" class="nav-username">{{ username }}</span>
              <span class="fd-icon-label">Account</span>
            </router-link>
          </li>
        </ul>
      </div>
    </div>
  </nav>
  <main class="fd-main" :class="{ 'container fd-page': !route.meta.fullBleed }">
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
      <p class="fd-eyebrow">Welcome to FastDeal</p>
      <h1 id="fd-entry-title" class="fd-page-title">How would you like to continue?</h1>
      <p class="fd-entry-description">
        Log in to save products and set price alerts, or continue as a guest to search, compare, and see what's trending.
      </p>
      <div class="fd-entry-actions">
        <button
          ref="loginButton"
          class="btn btn-dark fd-btn-lg"
          type="button"
          @click="openAccountPage('/login')"
        >Log in</button>
        <button
          class="btn btn-outline-dark fd-btn-lg"
          type="button"
          @click="chooseGuest"
        >Continue as guest</button>
      </div>
      <p class="fd-entry-signup">
        New to FastDeal?
        <a href="/signup" @click.prevent="openAccountPage('/signup')">Create an account</a>
      </p>
    </section>
  </div>
</template>
