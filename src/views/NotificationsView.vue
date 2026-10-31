<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth.js'
import { storeToRefs } from 'pinia'
const { user } = storeToRefs(useAuthStore())
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import axios from 'axios'
import FdIcon from '../components/FdIcon.vue'
import FdLoadingDots from '../components/FdLoadingDots.vue'
import FdTelegramPrompt from '../components/FdTelegramPrompt.vue'

const showTelegramPrompt = ref(false)

const route = useRoute()
const router = useRouter()
const notifications = ref([])

// Tabs like the Friends page: alerts about saved products, and alerts from friends.
// A link can open one with ?tab=wishlist or ?tab=friends.
const TABS = [
  { id: 'all', label: 'All', types: null },
  { id: 'wishlist', label: 'Wishlist', types: ['price-drop', 'target-hit', 'sale-soon', 'sleep-ended'] },
  { id: 'friends', label: 'Friends', types: ['friend-request', 'friend-accepted', 'group-invite', 'group-order'] }
]

// The round icon in front of each notification, so its kind shows at a glance.
const TYPE_ICONS = {
  'price-drop': 'trending-down',
  'target-hit': 'target',
  'sale-soon': 'calendar',
  'sleep-ended': 'moon',
  'friend-request': 'user-plus',
  'friend-accepted': 'friends',
  'group-invite': 'cart',
  'group-order': 'cart'
}

function iconFor(n) {
  return TYPE_ICONS[n.type] || 'bell'
}

// "Just now", "5m ago", "3h ago", "2d ago", then the date, for example "12 Oct".
function timeAgo(date) {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return minutes + 'm ago'
  if (minutes < 24 * 60) return Math.floor(minutes / 60) + 'h ago'
  if (minutes < 7 * 24 * 60) return Math.floor(minutes / (24 * 60)) + 'd ago'
  return new Date(date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

// Opening a notification also marks it read.
function openNotification(n) {
  if (!n.read) markRead(n)
}

const activeTab = ref(TABS.some(function (t) { return t.id === route.query.tab }) ? route.query.tab : 'all')

function inTab(tab, n) {
  return !tab.types || tab.types.includes(n.type)
}

function unreadCount(tab) {
  return notifications.value.filter(function (n) { return !n.read && inTab(tab, n) }).length
}

// One list, newest first, like the Friends list: a search box and an Unread only filter on top.
const query = ref('')
// 'all' or 'unread', from the Show dropdown. All by default.
const show = ref('all')

const tabItems = computed(function () {
  const tab = TABS.find(function (t) { return t.id === activeTab.value })
  return notifications.value.filter(function (n) { return inTab(tab, n) })
})

const shown = computed(function () {
  const q = query.value.trim().toLowerCase()
  return tabItems.value.filter(function (n) {
    if (show.value === 'unread' && n.read) {
      return false
    }
    return !q || (n.title + ' ' + (n.body || '')).toLowerCase().includes(q)
  })
})

const totalUnread = computed(function () {
  return notifications.value.filter(function (n) { return !n.read }).length
})

// The bottom bar, worded like the Wishlist's and Friends': "Total: 12 notifications (3 unread)"
// for the open tab.
const barText = computed(function () {
  const total = tabItems.value.length
  const unread = tabItems.value.filter(function (n) { return !n.read }).length
  return 'Total: ' + total + ' ' + (total === 1 ? 'notification' : 'notifications') + ' (' + unread + ' unread)'
})

// Arrow keys move between tabs, as tab lists do.
function onTabKey(event, index) {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!step) {
    return
  }
  const next = TABS[(index + step + TABS.length) % TABS.length]
  activeTab.value = next.id
  document.getElementById('fd-ntab-' + next.id)?.focus()
}

// Scrollbar inside the card, the same as the Friends page: always visible, arrows jump to the
// top or bottom, and the blue handle can be dragged.
const listEl = ref(null)
const trackEl = ref(null)
const canScroll = ref(false)
const thumbSize = ref(20)
const thumbTop = ref(0)

function updateBar() {
  const el = listEl.value
  if (!el) {
    canScroll.value = false
    return
  }
  const room = el.scrollHeight - el.clientHeight
  canScroll.value = room > 1
  thumbSize.value = canScroll.value
    ? Math.min(Math.max((el.clientHeight / el.scrollHeight) * 100, 12), 40)
    : 20
  thumbTop.value = canScroll.value
    ? (el.scrollTop / room) * (100 - thumbSize.value)
    : Math.min(thumbTop.value, 100 - thumbSize.value)
}

function moveIdleThumb(top) {
  thumbTop.value = Math.min(Math.max(top, 0), 100 - thumbSize.value)
}

function scrollStep(direction) {
  if (!canScroll.value) {
    moveIdleThumb(direction < 0 ? 0 : 100)
    return
  }
  const el = listEl.value
  el.scrollTo({ top: direction < 0 ? 0 : el.scrollHeight, behavior: 'smooth' })
}

function onTrackPress(event) {
  const el = listEl.value
  const thumb = trackEl.value.querySelector('.fd-scrollbar-thumb').getBoundingClientRect()
  const direction = event.clientY < thumb.top ? -1 : 1
  if (!canScroll.value) {
    moveIdleThumb(thumbTop.value + direction * thumbSize.value)
    return
  }
  el.scrollBy({ top: direction * el.clientHeight * 0.9, behavior: 'smooth' })
}

let dragStartY = 0
let dragStartScroll = 0
let dragStartTop = 0

function onThumbDown(event) {
  event.preventDefault()
  dragStartY = event.clientY
  dragStartScroll = listEl.value.scrollTop
  dragStartTop = thumbTop.value
  event.currentTarget.setPointerCapture(event.pointerId)
}

function onThumbMove(event) {
  if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
    return
  }
  const el = listEl.value
  if (!canScroll.value) {
    moveIdleThumb(dragStartTop + ((event.clientY - dragStartY) / trackEl.value.clientHeight) * 100)
    return
  }
  const free = trackEl.value.clientHeight * (1 - thumbSize.value / 100)
  if (free > 0) {
    el.scrollTop = dragStartScroll + ((event.clientY - dragStartY) * (el.scrollHeight - el.clientHeight)) / free
  }
}

let barObserver = null

watch(listEl, function (el) {
  barObserver?.disconnect()
  if (el) {
    barObserver = new ResizeObserver(updateBar)
    barObserver.observe(el)
    if (el.firstElementChild) {
      barObserver.observe(el.firstElementChild)
    }
    nextTick(updateBar)
  }
})

// A new tab starts at the top.
watch(activeTab, function () {
  if (listEl.value) {
    listEl.value.scrollTop = 0
  }
  nextTick(updateBar)
})

watch(shown, function () {
  nextTick(updateBar)
})

// group-order popup: initiator picks which friends to invite
const buyItem = ref(null)
const buyFriends = ref([])
const buyLoading = ref(false)
const buyError = ref('')
const buySelected = ref(new Set())
const buyInviting = ref(false)
const buyInviteSent = ref(false)
const buyDialog = ref(null)

// group-invite popup: friend sees sender's telegram
const inviteItem = ref(null)
const inviterProfile = ref(null)
const inviterLoading = ref(false)
const inviterError = ref('')
const inviteDialog = ref(null)

if (!user.value) {
  router.replace('/login?next=/notifications')
}

async function load() {
  const res = await axios.get('/api/notifications')
  notifications.value = res.data
}

async function markRead(n) {
  await axios.put('/api/notifications/' + n._id + '/read')
  n.read = true
}

async function markAllRead() {
  await axios.put('/api/notifications/read-all')
  notifications.value.forEach(n => { n.read = true })
}

// The product title for a notification, from my own wishlist. Buy Together is only for products
// both friends saved, so it is there; null if it was removed since.
function productName(n) {
  const item = (user.value.wishlist || []).find(w => w.productKey === n.productKey)
  return item ? item.name : null
}

// The sender, from the invite title "zoedharm wants to buy together!"
function inviterName(n) {
  return n.title.split(' wants ')[0]
}

function isBuyTogether(n) { return n.type === 'group-order' }
function isGroupInvite(n) { return n.type === 'group-invite' }

// Initiator opens checklist popup
async function openBuyTogether(n) {
  if (!user.value.telegramUsername) {
    showTelegramPrompt.value = true
    return
  }
  buyItem.value = n
  buyFriends.value = []
  buyError.value = ''
  buyInviteSent.value = false
  buyLoading.value = true
  nextTick(() => buyDialog.value?.querySelector('button')?.focus())
  try {
    const res = await axios.get('/api/buy-together', { params: { productKey: n.productKey } })
    buyFriends.value = res.data
    buySelected.value = new Set(res.data.map(f => f.firebaseUid))
  } catch (err) {
    buyError.value = err.response?.data?.error || 'Could not load your friends. Try again.'
  } finally {
    buyLoading.value = false
  }
  if (!n.read) markRead(n)
}

function toggleSelect(uid) {
  const next = new Set(buySelected.value)
  next.has(uid) ? next.delete(uid) : next.add(uid)
  buySelected.value = next
}

async function sendInvites() {
  if (!buySelected.value.size || !buyItem.value) return
  buyInviting.value = true
  buyError.value = ''
  try {
    await axios.post('/api/buy-together/invite', {
      friendUids: [...buySelected.value],
      productKey: buyItem.value.productKey
    })
    buyInviteSent.value = true
  } catch (err) {
    buyError.value = err.response?.data?.error || 'Could not send invites. Try again.'
  } finally {
    buyInviting.value = false
  }
}

function closeBuyTogether() { buyItem.value = null }

// Friend opens sender profile popup
async function openGroupInvite(n) {
  inviteItem.value = n
  inviterProfile.value = null
  inviterError.value = ''
  inviterLoading.value = true
  nextTick(() => inviteDialog.value?.querySelector('button')?.focus())
  try {
    const res = await axios.get('/api/users/profile/' + n.fromUid)
    inviterProfile.value = res.data
  } catch (err) {
    // 403: the server only shows a friend's profile, and this friendship has ended.
    inviterError.value = err.response?.status === 403
      ? 'You are no longer friends with ' + inviterName(n) + ', so this invite expired.'
      : err.response?.data?.error || 'Could not load their profile.'
  } finally {
    inviterLoading.value = false
  }
  if (!n.read) markRead(n)
}

function closeGroupInvite() { inviteItem.value = null }

onMounted(load)
</script>

<template>
  <div v-if="user" class="notif-page">
    <h1 class="fd-page-title">Notifications</h1>
    <p class="fd-page-subtitle">Price drops, Sleep on it reminders, and news from your friends.</p>

    <div class="notif-tabs" role="tablist" aria-label="Notifications">
      <button
        v-for="(tab, i) in TABS"
        :id="'fd-ntab-' + tab.id"
        :key="tab.id"
        class="notif-tab"
        :class="{ 'is-active': activeTab === tab.id }"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        aria-controls="fd-ntabpanel"
        :tabindex="activeTab === tab.id ? 0 : -1"
        @click="activeTab = tab.id"
        @keydown="onTabKey($event, i)"
      >
        <span class="notif-tab-label">{{ tab.label }}</span>
        <!-- Unread count beside the label, like the Requests tab on the Friends page. -->
        <span v-if="unreadCount(tab)" class="fd-count notif-badge"
          :aria-label="unreadCount(tab) + ' unread'">{{ unreadCount(tab) }}</span>
      </button>
    </div>

    <!-- The open tab and this card are one piece, like a folder tab. -->
    <div id="fd-ntabpanel" class="notif-tabpanel" :class="{ 'is-first-open': activeTab === 'all' }"
      role="tabpanel" :aria-labelledby="'fd-ntab-' + activeTab">
      <div class="notif-tools">
        <div class="notif-search">
          <input v-model="query" class="notif-search-input" type="text" placeholder="Search notifications"
            aria-label="Search notifications" autocomplete="off" />
          <span class="notif-search-icon" aria-hidden="true">
            <FdIcon name="search" />
          </span>
        </div>
        <div class="notif-filter">
          <label for="notif-show">Show</label>
          <select id="notif-show" v-model="show" class="form-select">
            <option value="all">All</option>
            <option value="unread">Unread only</option>
          </select>
        </div>
      </div>

      <div class="notif-body">
        <div ref="listEl" class="notif-scroll" tabindex="0" aria-label="Notifications list" @scroll="updateBar">
          <div>
            <div v-if="!tabItems.length" class="empty-state">
              <FdIcon name="bell" class="empty-icon" />
              <p class="empty-text">No notifications here yet.</p>
            </div>

            <!-- A search with no matches is a grey note, like Friends' "No friends match". -->
            <p v-else-if="!shown.length && query.trim()" class="alert alert-secondary">
              No notifications match "{{ query.trim() }}".
            </p>

            <!-- Nothing unread: the same icon-and-line empty state as Friends' "No requests waiting". -->
            <div v-else-if="!shown.length" class="empty-state">
              <FdIcon name="bell" class="empty-icon" />
              <p class="empty-text">No unread notifications.</p>
            </div>

            <!-- One list with a line between rows: round icon, title with an unread dot, time,
                 then the message. Buy Together rows keep their buttons under the message. -->
            <ul v-else class="notif-rows">
              <li v-for="n in shown" :key="n._id" class="notif-row-item">
                <div v-if="isBuyTogether(n) || isGroupInvite(n)" class="notif-row">
                  <span class="notif-icon" aria-hidden="true"><FdIcon :name="iconFor(n)" /></span>
                  <div class="notif-main">
                    <div class="notif-head">
                      <p class="notif-title"><span v-if="!n.read" class="unread-dot" aria-label="Unread"></span>{{ n.title }}</p>
                      <span class="notif-time">{{ timeAgo(n.createdAt) }}</span>
                    </div>
                    <p class="notif-text">{{ n.body }}</p>
                    <div class="notif-actions">
                      <button v-if="isBuyTogether(n)" class="btn btn-sm" :class="n.read ? 'btn-outline-dark' : 'btn-dark'" type="button" @click="openBuyTogether(n)">Buy Together</button>
                      <button v-else class="btn btn-sm" :class="n.read ? 'btn-outline-dark' : 'btn-dark'" type="button" @click="openGroupInvite(n)">{{ n.read ? 'View' : 'Buy Together' }}</button>
                      <button v-if="!n.read" class="btn btn-sm btn-outline-dark" type="button" @click="markRead(n)">Dismiss</button>
                    </div>
                  </div>
                </div>

                <router-link v-else :to="n.link || '/'" class="notif-row notif-row-link" @click="openNotification(n)">
                  <span class="notif-icon" aria-hidden="true"><FdIcon :name="iconFor(n)" /></span>
                  <div class="notif-main">
                    <div class="notif-head">
                      <p class="notif-title"><span v-if="!n.read" class="unread-dot" aria-label="Unread"></span>{{ n.title }}</p>
                      <span class="notif-time">{{ timeAgo(n.createdAt) }}</span>
                    </div>
                    <p class="notif-text">{{ n.body }}</p>
                  </div>
                </router-link>
              </li>
            </ul>
          </div>
        </div>

        <!-- Hidden from screen readers: the list itself scrolls with the keyboard. -->
        <div class="fd-scrollbar" aria-hidden="true">
          <button class="fd-scrollbar-arrow" type="button" tabindex="-1" @click="scrollStep(-1)">
            <FdIcon name="chevron-up" />
          </button>
          <div ref="trackEl" class="fd-scrollbar-track" @pointerdown.self="onTrackPress">
            <div
              class="fd-scrollbar-thumb"
              :style="{ top: thumbTop + '%', height: thumbSize + '%' }"
              @pointerdown="onThumbDown"
              @pointermove="onThumbMove"
            ></div>
          </div>
          <button class="fd-scrollbar-arrow" type="button" tabindex="-1" @click="scrollStep(1)">
            <FdIcon name="chevron-down" />
          </button>
        </div>
      </div>
    </div>

    <!-- Sticks to the bottom of the screen, like the Friends and Wishlist bars. -->
    <div class="notif-bar">
      <p class="notif-bar-count" aria-live="polite">{{ barText }}</p>
      <button v-if="totalUnread" class="btn btn-outline-dark" type="button" @click="markAllRead">Mark all as read</button>
    </div>

    <FdTelegramPrompt v-if="showTelegramPrompt" @close="showTelegramPrompt = false" />

    <!-- Popup A: initiator picks friends to invite. Laid out like the Buy Together pop-up on the Wishlist. -->
    <div v-if="buyItem" class="fd-entry-backdrop" @click.self="closeBuyTogether" @keydown.esc="closeBuyTogether">
      <section ref="buyDialog" class="fd-entry-dialog fd-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="fd-buy-title">
        <h2 id="fd-buy-title" class="fd-page-title">Buy together</h2>
        <p v-if="productName(buyItem)" class="fd-entry-description">
          {{ buyFriends.length === 1 ? 'A friend' : 'Friends' }} saved
          <strong>{{ productName(buyItem) }}</strong> too. Buy it together and share the shipping.
        </p>
        <p v-else class="fd-entry-description">Buy it together and share the shipping.</p>

        <FdLoadingDots v-if="buyLoading" size="inline" message="Finding your friends" />
        <p v-else-if="buyError" class="alert alert-danger" role="alert">{{ buyError }}</p>
        <p v-else-if="!buyFriends.length" class="text-secondary">None of your friends has this product saved right now.</p>

        <div v-else class="mb-4">
          <p class="fd-list-heading">Friends to invite</p>
          <p class="small text-secondary mb-2">Tick who to invite. They get your Telegram and can message you if
            they're keen.</p>
          <ul class="fd-check-list">
            <li v-for="f in buyFriends" :key="f.firebaseUid">
              <input
                type="checkbox"
                class="form-check-input"
                :id="'chk-' + f.firebaseUid"
                :checked="buySelected.has(f.firebaseUid)"
                @change="toggleSelect(f.firebaseUid)"
              />
              <label :for="'chk-' + f.firebaseUid" class="fd-check-label">
                <span>{{ f.username }}</span>
              </label>
            </li>
          </ul>
        </div>

        <div v-if="buyInviteSent" class="alert alert-success mb-3" role="status">Invite sent! They'll text you if they're interested.</div>

        <div class="fd-entry-actions">
          <button v-if="!buyInviteSent && buyFriends.length" class="btn btn-dark" type="button"
            :disabled="buyInviting || !buySelected.size" @click="sendInvites">
            {{ buyInviting ? 'Sending…' : 'Send Invites' }}
          </button>
          <button class="btn btn-outline-dark" type="button" @click="closeBuyTogether">
            {{ buyInviteSent ? 'Done' : 'Cancel' }}
          </button>
        </div>
      </section>
    </div>

    <!-- Popup B: friend sees sender's telegram to coordinate. Same layout as Popup A. -->
    <div v-if="inviteItem" class="fd-entry-backdrop" @click.self="closeGroupInvite" @keydown.esc="closeGroupInvite">
      <section ref="inviteDialog" class="fd-entry-dialog fd-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="fd-invite-title">
        <h2 id="fd-invite-title" class="fd-page-title">Buy together</h2>
        <p v-if="productName(inviteItem)" class="fd-entry-description">
          {{ inviterName(inviteItem) }} invited you to buy <strong>{{ productName(inviteItem) }}</strong> together and
          share the shipping.
        </p>
        <p v-else class="fd-entry-description">{{ inviteItem.body }}</p>

        <FdLoadingDots v-if="inviterLoading" size="inline" message="Loading their profile" />
        <p v-else-if="inviterError" class="alert alert-danger" role="alert">{{ inviterError }}</p>

        <p v-else-if="inviterProfile && !inviterProfile.telegramUsername" class="small text-secondary">
          {{ inviterProfile.username }} has not set a Telegram yet.
        </p>

        <!-- Full-size stacked buttons, like every other pop-up -->
        <div class="fd-entry-actions">
          <a v-if="inviterProfile && inviterProfile.telegramUsername"
            class="btn btn-dark"
            :href="'https://t.me/' + inviterProfile.telegramUsername"
            :aria-label="'Message ' + inviterProfile.username + ' on Telegram'"
            target="_blank" rel="noopener">
            Message on Telegram
          </a>
          <button class="btn btn-outline-dark" type="button" @click="closeGroupInvite">Close</button>
        </div>
      </section>
    </div>

  </div>
</template>

<style scoped>
/* Every outline on the page is the vanilla line, like the Friends page. */
.notif-page {
  --notif-line: var(--fd-vanilla-line);
  display: flex;
  flex-direction: column;
  /* At least the screen below the navbar: a short list fills the screen down to the total bar.
     A longer list makes the card taller (up to the list's maximum) and the page scrolls, with
     the sticky total bar cutting across the card until the end. */
  min-height: calc(100svh - var(--fd-nav-height) - 2.5rem);
}

/* Folder tabs, the same look and spacing as the Friends page tabs. */
.notif-tabs {
  display: flex;
}

.notif-tab {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  min-height: 3.5rem;
  padding: 0 1.75rem;
  border: var(--fd-border) solid transparent;
  border-bottom: 0;
  border-radius: var(--fd-radius) var(--fd-radius) 0 0;
  background: transparent;
  color: var(--fd-text-muted);
  font-size: var(--fd-table-header);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
}

.notif-tab:hover {
  color: var(--fd-blue);
}

.notif-tab.is-active {
  z-index: 1;
  border-color: var(--notif-line);
  background: var(--fd-paper);
  color: var(--fd-text);
}

/* The blue line sits under the label only, so it stops before the unread count. */
.notif-tab-label {
  position: relative;
  display: inline-block;
}

.notif-tab.is-active .notif-tab-label::after {
  content: '';
  position: absolute;
  top: calc(100% + 0.3rem);
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 999px;
  background: var(--fd-blue);
}

.notif-tab:focus-visible {
  outline: 3px solid var(--fd-blue);
  outline-offset: -3px;
}

/* Unread count on a tab: the shared .fd-count bubble from app.css, a little after the label. */
.notif-badge {
  margin-left: 0.4rem;
}

.notif-tabpanel {
  position: relative;
  /* Fills the screen down to the total bar: the search on top, the scrolling list under it */
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  margin-bottom: 1.5rem;
  margin-top: calc(var(--fd-border) * -1);
  padding: 1.25rem;
  border: var(--fd-border) solid var(--notif-line);
  border-radius: var(--fd-radius);
  background: var(--fd-paper);
}

.notif-tabpanel.is-first-open {
  border-top-left-radius: 0;
}

/* Search and the Unread only filter, ending where the cards end so the scrollbar's column
   stays free on the right. */
.notif-tools {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0 1.75rem 1rem 0;
}

/* The same pill as the Friends search. */
.notif-search {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
  min-height: var(--fd-search);
  padding: 0.125rem 1rem 0.125rem 1.5rem;
  border: var(--fd-border) solid var(--notif-line);
  border-radius: 999px;
  background: var(--fd-paper);
}

.notif-search:focus-within {
  border-color: var(--fd-blue);
  box-shadow: 0 0 0 0.25rem rgb(39 80 138 / 35%);
}

.notif-search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--fd-text);
  font-size: var(--fd-body);
  outline: none;
}

.notif-search-input::placeholder {
  color: var(--fd-text-muted);
}

.notif-search-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  color: var(--fd-blue);
}

/* Show dropdown, the same as the Wishlist's Sort by: a muted label, then a pill select. */
.notif-filter {
  display: flex;
  flex: 0 1 16rem;
  align-items: center;
  gap: 0.75rem;
}

.notif-filter label {
  flex-shrink: 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
  font-weight: 700;
}

.notif-filter .form-select {
  flex: 1 1 auto;
  min-height: var(--fd-search);
  padding: 0.375rem 3.25rem 0.375rem 1.5rem;
  border-radius: 999px;
  background-position: right 1.25rem center;
  font-size: var(--fd-body);
}

/* The scrolling list and its scrollbar side by side. */
.notif-body {
  display: flex;
  gap: 0.5rem;
  /* Fills the rest of the card, and grows with a longer list up to the same maximum as before
     (fits the screen, 20rem to 40rem); past that the list scrolls inside */
  flex: 1 1 auto;
  min-height: 0;
  max-height: clamp(20rem, calc(100svh - var(--fd-nav-height) - 16rem), 40rem);
}

.notif-scroll {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.notif-scroll::-webkit-scrollbar {
  display: none;
}

.notif-scroll:focus-visible {
  outline: 3px solid var(--fd-blue);
  outline-offset: 3px;
}

/* Room after the last item, so at the end of the scroll its bottom edge shows above the line */
.notif-scroll > div {
  padding-bottom: 1.25rem;
}

.notif-rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* A line between rows, none after the last. */
.notif-row-item + .notif-row-item {
  border-top: var(--fd-border) solid var(--notif-line);
}

.notif-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 0.25rem;
  color: var(--fd-text);
  text-decoration: none;
}

.notif-row-link:hover .notif-title {
  color: var(--fd-blue);
}

.notif-row-link:focus-visible {
  outline: 3px solid var(--fd-blue);
  outline-offset: 2px;
  border-radius: var(--fd-radius);
}

/* The round icon: a brand-blue circle with a beige icon, like the Friends page avatars. */
.notif-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--fd-blue);
  color: var(--fd-beige);
}

.notif-icon .fd-icon {
  width: 1.375rem;
  height: 1.375rem;
}

.notif-main {
  flex: 1;
  min-width: 0;
}

.notif-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.notif-title {
  margin: 0;
  font-size: var(--fd-body);
  font-weight: 700;
  color: var(--fd-ink);
}

.notif-time {
  flex-shrink: 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
  white-space: nowrap;
}

.notif-text {
  margin: 0.25rem 0 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
}

.notif-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

/* Marks an unread row, since read and unread share one list. */
.unread-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  margin-right: 0.5rem;
  border-radius: 50%;
  background: var(--fd-blue);
  vertical-align: middle;
}

/* Scrollbar: an arrow at each end and a beige track with a brand-blue handle to drag. */
.fd-scrollbar {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  width: 1.25rem;
  user-select: none;
}

.fd-scrollbar-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--fd-text-muted);
  cursor: pointer;
}

.fd-scrollbar-arrow:hover {
  background: var(--fd-beige);
  color: var(--fd-blue);
}

.fd-scrollbar-arrow .fd-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.fd-scrollbar-track {
  position: relative;
  flex: 1;
  width: 0.375rem;
  margin: 0.25rem 0;
  border-radius: 999px;
  background: var(--fd-beige);
  cursor: pointer;
}

.fd-scrollbar-thumb {
  position: absolute;
  left: 50%;
  width: 0.625rem;
  border-radius: 999px;
  background: var(--fd-blue);
  transform: translateX(-50%);
  cursor: grab;
  touch-action: none;
}

.fd-scrollbar-thumb:hover,
.fd-scrollbar-thumb:active {
  background: var(--fd-blue-dark);
}

.fd-scrollbar-thumb:active {
  cursor: grabbing;
}

/* Bottom bar, the same as the Friends page's. */
.notif-bar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem 1rem;
  min-height: calc(var(--fd-control) + 1.5rem + var(--fd-border));
  /* Pushed to the bottom of the screen under the card */
  margin-top: auto;
  padding: 0.75rem 0;
  border-top: var(--fd-border) solid var(--notif-line);
  background: var(--fd-beige);
}

.notif-bar-count {
  margin: 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--fd-text-muted);
}

.empty-icon {
  width: 2.5rem;
  height: 2.5rem;
  margin: 0 auto 0.75rem;
  color: var(--fd-blue);
}

.empty-text {
  font-size: var(--fd-small);
}

/* Phones: the three tabs share the width evenly, and a long label wraps. */
@media (max-width: 576px) {
  .notif-tab {
    flex: 1 1 0;
    justify-content: center;
    padding: 0 0.5rem;
    white-space: normal;
    text-align: center;
    letter-spacing: 0.04em;
  }

  .notif-tabpanel {
    padding: 1rem;
  }

  .notif-tools {
    gap: 0.5rem;
  }

  .notif-tools {
    flex-wrap: wrap;
  }

  .notif-search {
    flex-basis: 100%;
  }

  .notif-filter {
    flex: 1 1 100%;
  }

  .notif-row {
    gap: 0.75rem;
  }

  .notif-icon {
    width: 2.5rem;
    height: 2.5rem;
  }
}
</style>
