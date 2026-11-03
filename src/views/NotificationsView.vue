<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth.js'
import { storeToRefs } from 'pinia'
const { user } = storeToRefs(useAuthStore())
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import axios from 'axios'
import FdIcon from '../components/FdIcon.vue'
import FdAvatar from '../components/FdAvatar.vue'
import FdLoadingDots from '../components/FdLoadingDots.vue'
import FdTelegramPrompt from '../components/FdTelegramPrompt.vue'
import FdTabs from '../components/FdTabs.vue'
import FdListSearch from '../components/FdListSearch.vue'
import FdScrollArea from '../components/FdScrollArea.vue'
import FdEmptyState from '../components/FdEmptyState.vue'

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

// The tab card (for the pager to scroll back to) and the scrolling list inside it
const scrollArea = ref(null)

function inTab(tab, n) {
  return !tab.types || tab.types.includes(n.type)
}

function unreadCount(tab) {
  return notifications.value.filter(function (n) { return !n.read && inTab(tab, n) }).length
}

// Each tab carries its unread count, like the Requests tab on the Friends page.
const tabs = computed(function () {
  return TABS.map(function (t) {
    const count = unreadCount(t)
    return { ...t, count, countLabel: count + ' unread' }
  })
})

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

// A new tab starts at the top of its list.
watch(activeTab, function () {
  scrollArea.value?.toTop()
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

// The whole list, scrolling inside its card, with the total under the card.
const listTotal = computed(function () { return shown.value.length })
</script>

<template>
  <div v-if="user" class="fd-list-page">
    <h1 class="fd-page-title">Notifications</h1>
    <p class="fd-page-subtitle">Price drops, Sleep on it reminders, and news from your friends.</p>

    <!-- The open tab and the card under it are one piece, like a folder tab. -->
    <FdTabs v-model="activeTab" :tabs="tabs" label="Notifications" id-prefix="fd-ntab">
      <!-- Search and the filter only once the open tab has something to search, like the Wishlist. -->
      <div v-if="tabItems.length" class="fd-list-tools notif-tools">
        <FdListSearch v-model="query" placeholder="Search notifications" label="Search notifications" />
        <div class="fd-sort">
          <label for="notif-show">Show</label>
          <select id="notif-show" v-model="show" class="form-select">
            <option value="all">All</option>
            <option value="unread">Unread only</option>
          </select>
        </div>
      </div>

      <FdScrollArea ref="scrollArea" fill page label="Notifications list" :bar="tabItems.length > 0">
        <FdEmptyState v-if="!tabItems.length" icon="bell">No notifications here yet.</FdEmptyState>

        <!-- A search with no matches is a grey note, like Friends' "No friends match". -->
        <p v-else-if="!shown.length && query.trim()" class="alert alert-secondary">
          No notifications match "{{ query.trim() }}".
        </p>

        <!-- Nothing unread: the same icon-and-line empty state as Friends' "No requests waiting". -->
        <FdEmptyState v-else-if="!shown.length" icon="bell">No unread notifications.</FdEmptyState>

        <!-- One list with a line between rows: round icon, title with an unread dot, time,
             then the message. Buy Together rows keep their buttons under the message. -->
        <ul v-else class="notif-rows">
          <li v-for="n in shown" :key="n._id" class="notif-row-item">
            <div v-if="isBuyTogether(n) || isGroupInvite(n)" class="notif-row">
              <FdAvatar class="notif-icon" :icon="iconFor(n)" />
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
              <FdAvatar class="notif-icon" :icon="iconFor(n)" />
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
      </FdScrollArea>
    </FdTabs>

    <!-- Under the card: Mark all as read on the left, on every tab; with nothing unread it stays,
         greyed out, instead of disappearing. The total on the right. -->
    <div v-if="notifications.length" class="notif-foot">
      <button class="btn btn-outline-dark notif-mark-all" type="button" :disabled="!totalUnread"
        @click="markAllRead">{{ totalUnread ? 'Mark all as read' : 'All read' }}</button>
      <p v-if="listTotal > 0" class="fd-list-total notif-total">Total: {{ listTotal }} {{ listTotal === 1 ? 'notification' : 'notifications' }}</p>
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
/* The Show dropdown is a little narrower than a Sort by. */
.notif-tools .fd-sort {
  flex-basis: 16rem;
}

/* All read: the button says so and fades like a disabled pager button. */
.notif-mark-all:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Under the card: the button on the left, the total on the right, centred on each other. */
.notif-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  margin-top: 0.75rem;
}

.notif-foot .notif-total {
  margin: 0 0 0 auto;
}

.notif-rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* A line between rows, none after the last. */
.notif-row-item + .notif-row-item {
  border-top: var(--fd-border) solid var(--fd-vanilla-line);
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

/* The round icon (FdAvatar): a little bigger than the 44px initials circles. */
.notif-icon {
  width: 3rem;
  height: 3rem;
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

@media (max-width: 576px) {
  .notif-row {
    gap: 0.75rem;
  }

  .notif-icon {
    width: 2.5rem;
    height: 2.5rem;
  }
}
</style>
