<script setup>
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth.js'
import { storeToRefs } from 'pinia'
const { user, firebaseUser, authReady } = storeToRefs(useAuthStore())
import {
  getFriends,
  getIncomingRequests,
  getSentRequests,
  searchUsers,
  sendRequest,
  acceptRequest,
  declineOrRemove
} from '../services/friendsApi.js'
import FdIcon from '../components/FdIcon.vue'
import FdLoadingDots from '../components/FdLoadingDots.vue'

const router = useRouter()
const route = useRoute()

// Wait for Firebase to finish restoring session before deciding to redirect.
// Immediate: true means this runs right away AND again when authReady flips to true.
watch(authReady, (ready) => {
  if (ready && !user.value) router.replace('/login?next=/friends')
}, { immediate: true })

const friends = ref([])
const requests = ref([])
// Requests I sent that have not been answered yet, shown as Pending under Requests.
const sent = ref([])
const searchQuery = ref('')

// Filters the Friend List as you type, like the Wishlist search: a friend shows when the
// typed text appears in their username or email, ignoring capitals.
const friendQuery = ref('')
const shownFriends = computed(function () {
  const words = friendQuery.value.trim().toLowerCase()
  if (!words) {
    return friends.value
  }
  return friends.value.filter(function (f) {
    return (f.username || '').toLowerCase().includes(words) || (f.email || '').toLowerCase().includes(words)
  })
})

// The count under the list, worded like the Wishlist's: "Total: 5 friends", or
// "2 of 5 friends shown" while searching.
const friendCount = computed(function () {
  const total = friends.value.length
  const noun = total === 1 ? 'friend' : 'friends'
  if (friendQuery.value.trim()) {
    return shownFriends.value.length + ' of ' + total + ' ' + noun + ' shown'
  }
  return 'Total: ' + total + ' ' + noun
})
const allSearchResults = ref([]) // full results from the last API call
const searching = ref(false)
let searchTimer = null

// Local filter on top of the API results — reactive as you type.
// .includes() filters down the already-fetched list instantly between API calls.
const searchResults = computed(() =>
  allSearchResults.value.filter(r =>
    !searchQuery.value || (r.username || '').toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)
const loadingFriends = ref(false)
const actionLoading = ref({}) // pairKey -> true while in flight

const myUid = computed(() => firebaseUser.value?.uid)

// Fetch both the friends list and incoming requests in parallel on page load.
async function load() {
  if (!myUid.value) return
  loadingFriends.value = true
  try {
    const [f, r, sentList] = await Promise.all([
      getFriends(),       // GET /api/friends
      getIncomingRequests(), // GET /api/friends/requests
      getSentRequests()   // GET /api/friends/sent
    ])
    friends.value = f
    requests.value = r
    sent.value = sentList
    console.log('[Friends] loaded', f.length, 'friends,', r.length, 'pending requests')
  } catch (err) {
    console.warn('[Friends] load failed:', err.message)
  } finally {
    loadingFriends.value = false
  }
}

onMounted(load)

// Three tabs, like pages of one section: Friends, Add Friend, Requests. A link can open one
// with ?tab=add or ?tab=requests (friend-request notifications do). Switching tabs stays inside
// the page: changing the address would rebuild it (App.vue keys the page by its address),
// reloading the lists and clearing the search boxes.
const TABS = [
  { id: 'friends', label: 'Friends' },
  { id: 'add', label: 'Add Friend' },
  { id: 'requests', label: 'Requests' }
]

const activeTab = ref(TABS.some(function (t) { return t.id === route.query.tab }) ? route.query.tab : 'friends')

function openTab(id) {
  activeTab.value = id
}

// Arrow keys move between tabs, as tab lists do.
function onTabKey(event, index) {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!step) {
    return
  }
  const next = TABS[(index + step + TABS.length) % TABS.length]
  openTab(next.id)
  document.getElementById('fd-tab-' + next.id)?.focus()
}

// The sticky bar at the bottom, worded like the Wishlist's total.
const barText = computed(function () {
  if (activeTab.value === 'add') {
    return 'Search by username to send a request'
  }
  if (activeTab.value === 'requests') {
    return requests.value.length + ' waiting for you · ' + sent.value.length + ' sent by you'
  }
  return friendCount.value
})

watch(myUid, load)

// Scrollbar inside the card: always visible, with arrows that jump to the top or bottom and a
// brand-blue handle to drag, since browsers on a Mac hide their own until you scroll. The card's
// contents scroll natively (wheel, trackpad, touch, keyboard) and the bar follows; the bar can
// also drive them. With nothing to scroll, the handle still slides but moves nothing.
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
  // A small handle: its share of the track, kept between 12% and 40%; 20% with nothing to scroll.
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

// The arrows jump straight to the very top (-1) or the very bottom (1).
function scrollStep(direction) {
  if (!canScroll.value) {
    moveIdleThumb(direction < 0 ? 0 : 100)
    return
  }
  const el = listEl.value
  el.scrollTo({ top: direction < 0 ? 0 : el.scrollHeight, behavior: 'smooth' })
}

// A press on the empty track jumps one page toward the press.
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

// Dragging the handle: moving it the full free length of the track scrolls everything.
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

// Re-measure when the card or its contents change size: a new tab, search results, friends.
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

watch(activeTab, function () {
  if (listEl.value) {
    listEl.value.scrollTop = 0
  }
  nextTick(function () {
    if (listEl.value?.firstElementChild) {
      barObserver?.observe(listEl.value.firstElementChild)
    }
    updateBar()
  })
})

onBeforeUnmount(function () {
  barObserver?.disconnect()
})

// Watch searchQuery and call the API with a 300ms debounce so we don't spam on every keystroke.
// The computed searchResults then filters the API response locally with .includes() in real time.
watch(searchQuery, (q) => {
  clearTimeout(searchTimer)
  if (!q.trim() || !myUid.value) {
    allSearchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      allSearchResults.value = await searchUsers(q.trim())
      console.log('[Friends] search results:', allSearchResults.value)
    } catch (err) {
      console.warn('[Friends] search failed:', err.message)
    } finally {
      searching.value = false
    }
  }, 300)
})

// POST /api/friends/request — creates a pending friendship row in MongoDB.
// Mutate allSearchResults so the computed searchResults re-filters and the button updates.
async function onSendRequest(result) {
  actionLoading.value[result.pairKey] = true
  try {
    await sendRequest(result.firebaseUid)
    const hit = allSearchResults.value.find(r => r.pairKey === result.pairKey)
    if (hit) { hit.friendshipStatus = 'pending'; hit.iRequested = true }
    sent.value.push({ pairKey: result.pairKey, firebaseUid: result.firebaseUid, username: result.username })
    console.log('[Friends] request sent to', result.username)
  } catch (err) {
    console.warn('[Friends] send request failed:', err.message)
  } finally {
    actionLoading.value[result.pairKey] = false
  }
}

// DELETE /api/friends/:pairKey on a request I sent: takes it back.
async function onCancel(req) {
  actionLoading.value[req.pairKey] = true
  try {
    await declineOrRemove(req.pairKey)
    sent.value = sent.value.filter(r => r.pairKey !== req.pairKey)
    const hit = allSearchResults.value.find(r => r.pairKey === req.pairKey)
    if (hit) { hit.friendshipStatus = null; hit.iRequested = null }
  } catch (err) {
    console.warn('[Friends] cancel request failed:', err.message)
  } finally {
    actionLoading.value[req.pairKey] = false
  }
}

// PUT /api/friends/:pairKey/accept — sets status to 'accepted'.
// Move the accepted user out of requests and into the friends list locally.
async function onAccept(req) {
  actionLoading.value[req.pairKey] = true
  try {
    await acceptRequest(req.pairKey)
    requests.value = requests.value.filter(r => r.pairKey !== req.pairKey)
    friends.value.push(req)
    const hit = allSearchResults.value.find(r => r.pairKey === req.pairKey)
    if (hit) hit.friendshipStatus = 'accepted'
    console.log('[Friends] accepted request from', req.username)
  } catch (err) {
    console.warn('[Friends] accept failed:', err.message)
  } finally {
    actionLoading.value[req.pairKey] = false
  }
}

// DELETE /api/friends/:pairKey — removes the friendship row entirely (decline or cancel).
async function onDecline(req) {
  actionLoading.value[req.pairKey] = true
  try {
    await declineOrRemove(req.pairKey)
    requests.value = requests.value.filter(r => r.pairKey !== req.pairKey)
    const hit = allSearchResults.value.find(r => r.pairKey === req.pairKey)
    if (hit) { hit.friendshipStatus = null; hit.iRequested = null }
    console.log('[Friends] declined request from', req.username)
  } catch (err) {
    console.warn('[Friends] decline failed:', err.message)
  } finally {
    actionLoading.value[req.pairKey] = false
  }
}

// DELETE /api/friends/:pairKey — same endpoint, but used on an existing friend to unfriend.
async function onRemove(friend) {
  if (!confirm(`Remove ${friend.username || friend.email} from friends?`)) return
  actionLoading.value[friend.pairKey] = true
  try {
    await declineOrRemove(friend.pairKey)
    friends.value = friends.value.filter(f => f.pairKey !== friend.pairKey)
    const hit = allSearchResults.value.find(r => r.pairKey === friend.pairKey)
    if (hit) { hit.friendshipStatus = null; hit.iRequested = null }
    console.log('[Friends] removed friend', friend.username)
  } catch (err) {
    console.warn('[Friends] remove failed:', err.message)
  } finally {
    actionLoading.value[friend.pairKey] = false
  }
}

function initials(f) {
  const name = f.username || f.email || '?'
  return name.slice(0, 2).toUpperCase()
}
</script>

<template>
  <!-- App.vue already wraps every page in the standard container (.fd-page), so no extra one here. -->
  <div v-if="user" class="friends-page">

    <h1 class="fd-page-title">Friend List</h1>
    <p class="fd-page-subtitle">Your friends on FastDeal, people to add, and requests waiting for you.</p>

    <div class="friend-tabs" role="tablist" aria-label="Friends">
      <button
        v-for="(tab, i) in TABS"
        :id="'fd-tab-' + tab.id"
        :key="tab.id"
        class="friend-tab"
        :class="{ 'is-active': activeTab === tab.id }"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :aria-controls="'fd-tabpanel-' + tab.id"
        :tabindex="activeTab === tab.id ? 0 : -1"
        @click="openTab(tab.id)"
        @keydown="onTabKey($event, i)"
      >
        {{ tab.label }}
        <span v-if="tab.id === 'requests' && requests.length" class="request-badge">{{ requests.length }}</span>
      </button>
    </div>

    <!-- The open tab and this card are one piece, like a folder tab. -->
    <div class="friend-tabpanel" :class="{ 'is-first-open': activeTab === 'friends' }">
      <!-- The search sits above the scrolling list, so the list and its scrollbar start together
           under it. Same pill as the Wishlist search. -->
      <div v-if="activeTab === 'friends' && !loadingFriends && friends.length" class="friend-search">
        <input v-model="friendQuery" class="friend-search-input" type="text" placeholder="Search your friends"
          aria-label="Search your friends by username or email" autocomplete="off" />
        <span class="friend-search-icon" aria-hidden="true">
          <FdIcon name="search" />
        </span>
      </div>
      <div v-else-if="activeTab === 'add'" class="friend-search">
        <input v-model="searchQuery" class="friend-search-input" type="text" placeholder="Type a username"
          aria-label="Search people by username" autocomplete="off" />
        <FdLoadingDots v-if="searching" size="inline" message="Searching" class="text-secondary" />
        <span v-else class="friend-search-icon" aria-hidden="true">
          <FdIcon name="search" />
        </span>
      </div>

      <div class="friend-body">
        <div ref="listEl" class="friend-scroll" tabindex="0" aria-label="Friends content" @scroll="updateBar">
          <!-- Friends -->
          <section v-if="activeTab === 'friends'" id="fd-tabpanel-friends" role="tabpanel" aria-labelledby="fd-tab-friends">
            <div v-if="loadingFriends" class="text-secondary">
              <FdLoadingDots size="inline" message="Loading friends" />
            </div>

            <div v-else-if="friends.length === 0" class="empty-state">
              <FdIcon name="friends" class="empty-icon" />
              <p class="empty-text">No friends yet. Open Add Friend to find someone by username.</p>
            </div>

            <template v-else>

              <p v-if="!shownFriends.length" class="alert alert-secondary">No friends match "{{ friendQuery }}".</p>

              <div v-else class="friend-rows">
                <div v-for="f in shownFriends" :key="f.pairKey" class="friend-card">
                  <div class="friend-avatar">{{ initials(f) }}</div>
                  <div class="friend-info">
                    <div class="friend-username">{{ f.username || '(no username)' }}</div>
                    <div class="friend-email">{{ f.email }}</div>
                  </div>
                  <button
                    class="btn btn-sm btn-outline-danger fd-icon-btn flex-shrink-0"
                    type="button"
                    :disabled="actionLoading[f.pairKey]"
                    :aria-label="'Remove ' + (f.username || f.email) + ' as a friend'"
                    title="Remove friend"
                    @click="onRemove(f)"
                  >
                    <FdIcon name="trash" />
                  </button>
                </div>
              </div>
            </template>
          </section>

          <!-- Add Friend -->
          <section v-else-if="activeTab === 'add'" id="fd-tabpanel-add" role="tabpanel" aria-labelledby="fd-tab-add">

            <div v-if="searchResults.length" class="friend-rows">
              <div v-for="r in searchResults" :key="r.pairKey" class="friend-card">
                <div class="friend-avatar">{{ initials(r) }}</div>
                <div class="friend-info">
                  <div class="friend-username">{{ r.username }}</div>
                </div>
                <div class="search-action">
                  <span v-if="r.friendshipStatus === 'accepted'" class="badge-friends">Friends</span>
                  <span v-else-if="r.friendshipStatus === 'pending' && r.iRequested" class="badge-pending">Pending</span>
                  <div v-else-if="r.friendshipStatus === 'pending' && !r.iRequested" class="d-flex gap-1">
                    <button class="btn btn-dark btn-sm" type="button" :disabled="actionLoading[r.pairKey]" @click="onAccept(r)">Accept</button>
                    <button class="btn btn-outline-dark btn-sm fd-icon-btn" type="button" :disabled="actionLoading[r.pairKey]" :aria-label="'Decline ' + r.username" title="Decline" @click="onDecline(r)">
                      <FdIcon name="x" />
                    </button>
                  </div>
                  <button
                    v-else
                    class="btn btn-dark btn-sm"
                    type="button"
                    :disabled="actionLoading[r.pairKey]"
                    @click="onSendRequest(r)"
                  >
                    Add friend
                  </button>
                </div>
              </div>
            </div>
            <p v-else-if="searchQuery.trim() && !searching" class="alert alert-secondary">No one matches "{{ searchQuery }}".</p>
          </section>

          <!-- Requests -->
          <section v-else id="fd-tabpanel-requests" role="tabpanel" aria-labelledby="fd-tab-requests">
            <h2 class="friend-group-title">Waiting for you</h2>
            <div v-if="requests.length" class="friend-rows">
              <div v-for="req in requests" :key="req.pairKey" class="friend-card">
                <div class="friend-avatar">{{ initials(req) }}</div>
                <div class="friend-info">
                  <div class="friend-username">{{ req.username || req.email }}</div>
                  <div class="friend-email">wants to be friends</div>
                </div>
                <div class="d-flex gap-1 flex-shrink-0">
                  <button
                    class="btn btn-dark btn-sm"
                    type="button"
                    :disabled="actionLoading[req.pairKey]"
                    @click="onAccept(req)"
                  >Accept</button>
                  <button
                    class="btn btn-outline-dark btn-sm fd-icon-btn"
                    type="button"
                    :disabled="actionLoading[req.pairKey]"
                    :aria-label="'Decline ' + (req.username || req.email)"
                    title="Decline"
                    @click="onDecline(req)"
                  >
                    <FdIcon name="x" />
                  </button>
                </div>
              </div>
            </div>
            <p v-else class="friend-group-empty">No one is waiting for an answer from you.</p>

            <h2 class="friend-group-title">Sent by you</h2>
            <div v-if="sent.length" class="friend-rows">
              <div v-for="req in sent" :key="req.pairKey" class="friend-card">
                <div class="friend-avatar">{{ initials(req) }}</div>
                <div class="friend-info">
                  <div class="friend-username">{{ req.username }}</div>
                  <div class="friend-email">has not answered yet</div>
                </div>
                <span class="badge-pending flex-shrink-0">Pending</span>
                <button
                  class="btn btn-outline-dark btn-sm flex-shrink-0"
                  type="button"
                  :disabled="actionLoading[req.pairKey]"
                  :aria-label="'Cancel the request to ' + req.username"
                  @click="onCancel(req)"
                >Cancel</button>
              </div>
            </div>
            <p v-else class="friend-group-empty">No requests waiting on other people.</p>
          </section>
        </div>

        <!-- Hidden from screen readers: the content itself scrolls with the keyboard. -->
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

    <!-- Sticks to the bottom of the screen while scrolling, like the Wishlist's total bar. -->
    <div class="friend-bar">
      <p class="friend-bar-count" aria-live="polite">{{ barText }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Friend search: the same pill as the Wishlist search. */
.friend-search {
  display: flex;
  margin-bottom: 1rem;
  align-items: center;
  gap: 0.25rem;
  min-height: var(--fd-search);
  /* 2px less than Home top and bottom: this bar has a border, so the total stays 44px.
     On the right, the same 16px as a card's padding, so the search icon lines up with the
     icon buttons (like the trash) at the end of the cards below. */
  padding: 0.125rem 1rem 0.125rem 1.5rem;
  border: var(--fd-border) solid var(--friends-line);
  border-radius: 999px;
  background: var(--fd-paper);
}

.friend-search:focus-within {
  border-color: var(--fd-blue);
  box-shadow: 0 0 0 0.25rem rgb(39 80 138 / 35%);
}

.friend-search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--fd-text);
  font-size: var(--fd-body);
  outline: none;
}

.friend-search-input::placeholder {
  color: var(--fd-text-muted);
}

/* Same size as the Home search bar's icon area: the bar is 48px tall like Home's. */
.friend-search-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  color: var(--fd-blue);
}

/* The page fills the screen below the navbar (minus the standard top gap), so the tab card can
   stretch down and the total bar always sits at the bottom of the screen, like the Wishlist's.
   Every outline on the page is the vanilla line, like the rest of the app's components. */
.friends-page {
  --friends-line: var(--fd-vanilla-line);
  display: flex;
  flex-direction: column;
  /* Exactly the screen, so the card's contents scroll inside it and the page itself does not.
     Very short windows keep enough room and let the page scroll instead. */
  height: calc(100svh - var(--fd-nav-height) - 2.5rem);
  min-height: 32rem;
}

/* Folder tabs: Friends, Add Friend, Requests. No strip behind them: the others sit on the page,
   and the open one is a raised paper tab joined to the card below it, with a short blue line
   under its label. */
.friend-tabs {
  display: flex;
  margin-top: 1.5rem;
}

.friend-tab {
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
  /* Table header type: small, bold capitals, spaced out. */
  font-size: var(--fd-table-header);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
}

.friend-tab:hover {
  color: var(--fd-blue);
}

/* The open tab: paper, outlined like the card, and sitting over the card's top edge so the
   two join with no line between them. */
.friend-tab.is-active {
  z-index: 1;
  border-color: var(--friends-line);
  background: var(--fd-paper);
  color: var(--fd-text);
}

.friend-tab.is-active::after {
  content: '';
  position: absolute;
  bottom: 0.625rem;
  left: 1.75rem;
  right: 1.75rem;
  height: 3px;
  border-radius: 999px;
  background: var(--fd-blue);
}

.friend-tab:focus-visible {
  outline: 3px solid var(--fd-blue);
  outline-offset: -3px;
}

/* The card under the tabs holds the open tab's content. It tucks up under the tabs by its
   border width, so the open tab (paper, above it) covers that line and the two join. */
.friend-tabpanel {
  position: relative;
  margin-top: calc(var(--fd-border) * -1);
  padding: 1.25rem;
  border: var(--fd-border) solid var(--friends-line);
  border-radius: var(--fd-radius);
  /* Fills the screen down to the total bar: the search on top, the scrolling list under it. */
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  margin-bottom: 1.5rem;
  background: var(--fd-paper);
}

/* With the first tab open, the card's top-left corner is square so the tab joins it cleanly. */
.friend-tabpanel.is-first-open {
  border-top-left-radius: 0;
}

/* The count bubble on Requests. */
.friend-tab .request-badge {
  margin-left: 0.5rem;
}

/* Phones: the three tabs share the width evenly with tighter padding, so they always fit. */
@media (max-width: 576px) {
  .friend-tab {
    flex: 1 1 auto;
    justify-content: center;
    padding: 0 0.5rem;
  }

  .friend-tab.is-active::after {
    left: 0.5rem;
    right: 0.5rem;
  }

  .friend-tabpanel {
    padding: 1rem;
  }
}

/* The card's scrolling area: the browser's own scrollbar is hidden for the custom one beside it.
   tabindex lets keyboard users scroll it. */
.friend-scroll {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.friend-scroll::-webkit-scrollbar {
  display: none;
}

.friend-scroll:focus-visible {
  outline: 3px solid var(--fd-blue);
  outline-offset: 3px;
}

/* The search ends where the friend cards end, leaving the scrollbar's column (its width plus
   the gap) free on the right. */
.friend-tabpanel > .friend-search {
  margin-right: 1.75rem;
}

/* Requests: "Waiting for you" and "Sent by you", each with its own small heading. */
.friend-group-title {
  margin: 0 0 0.75rem;
  color: var(--fd-text-muted);
  font-size: var(--fd-table-header);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.friend-rows + .friend-group-title,
.friend-group-empty + .friend-group-title {
  margin-top: 1.5rem;
}

.friend-group-empty {
  margin: 0;
  color: var(--fd-text-muted);
}

/* Under the search: the scrolling list and its scrollbar side by side, starting at the same
   line, so the bar begins level with the first friend. */
.friend-body {
  display: flex;
  flex: 1;
  gap: 0.5rem;
  min-height: 0;
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

/* The handle is brand blue and a little wider than its track, so it is easy to see and grab. */
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

/* One card per row, 12px apart, like the Wishlist; the page itself scrolls. */
.friend-rows {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Sticks to the bottom of the screen while scrolling and stops above the footer, like the
   Wishlist's total bar. */
.friend-bar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem 1rem;
  /* Same height as the Wishlist's bar, which holds a full-size button. */
  min-height: calc(var(--fd-control) + 1.5rem + var(--fd-border));
  /* Pushed to the bottom of the screen when the list is short; sticks there when it is long. */
  margin-top: auto;
  padding: 0.75rem 0;
  border-top: var(--fd-border) solid var(--friends-line);
  background: var(--fd-beige);
}

/* Same type as the Wishlist's total: small, muted. */
.friend-bar-count {
  margin: 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
}

.friend-card {
  flex-shrink: 0;
}

.friend-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  border: var(--fd-border) solid var(--friends-line);
  border-radius: var(--fd-radius);
  background: var(--fd-paper);
}

.friend-avatar {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--fd-blue);
  color: var(--fd-beige);
  /* Initials in DM Sans: the smallest Anton size is too big for a 44px circle. */
  font-family: var(--fd-font-body);
  font-size: var(--fd-body);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.friend-info {
  flex: 1;
  min-width: 0;
}

.friend-username {
  font-weight: 700;
  font-size: var(--fd-body);
  color: var(--fd-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.friend-email {
  font-size: var(--fd-small);
  color: var(--fd-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Empty state */
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

.search-result-row:last-child {
  border-bottom: none;
}

.search-action {
  flex-shrink: 0;
}

.badge-friends {
  font-size: var(--fd-small);
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: var(--fd-green-soft);
  color: var(--fd-ink);
}

.badge-pending {
  font-size: var(--fd-small);
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: var(--fd-vanilla-soft);
  color: var(--fd-text-muted);
  border: var(--fd-border) solid var(--friends-line);
}

/* Requests */
.request-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.25rem;
  border-radius: 50%;
  background: var(--fd-blue);
  color: var(--fd-beige);
  font-size: var(--fd-small);
  font-weight: 700;
  margin-left: 0.4rem;
  vertical-align: middle;
}

</style>
