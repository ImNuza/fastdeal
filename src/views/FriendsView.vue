<script setup>
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth.js'
import { storeToRefs } from 'pinia'
const { user, firebaseUser, authReady } = storeToRefs(useAuthStore())
import {
  getFriends,
  getIncomingRequests,
  searchUsers,
  sendRequest,
  acceptRequest,
  declineOrRemove
} from '../services/friendsApi.js'
import FdIcon from '../components/FdIcon.vue'
import FdLoadingDots from '../components/FdLoadingDots.vue'

const router = useRouter()

// Wait for Firebase to finish restoring session before deciding to redirect.
// Immediate: true means this runs right away AND again when authReady flips to true.
watch(authReady, (ready) => {
  if (ready && !user.value) router.replace('/login?next=/friends')
}, { immediate: true })

const friends = ref([])
const requests = ref([])
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
    const [f, r] = await Promise.all([
      getFriends(),       // GET /api/friends
      getIncomingRequests() // GET /api/friends/requests
    ])
    friends.value = f
    requests.value = r
    console.log('[Friends] loaded', f.length, 'friends,', r.length, 'pending requests')
  } catch (err) {
    console.warn('[Friends] load failed:', err.message)
  } finally {
    loadingFriends.value = false
  }
}

onMounted(load)

// Friend List scrollbar: always visible, with up and down arrows and a handle to drag, since
// browsers on a Mac hide their own until you scroll. The list scrolls natively (wheel, trackpad,
// touch, keyboard) and the bar follows it; the bar can also drive the list.
const listEl = ref(null)
const trackEl = ref(null)
const canScroll = ref(false)
const thumbSize = ref(100)
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
  // With nothing to scroll the handle still moves freely (see moveIdleThumb), so keep where it is.
  thumbTop.value = canScroll.value
    ? (el.scrollTop / room) * (100 - thumbSize.value)
    : Math.min(thumbTop.value, 100 - thumbSize.value)
}

// Nothing to scroll: the handle still slides along the track, it just moves no list.

function moveIdleThumb(top) {
  thumbTop.value = Math.min(Math.max(top, 0), 100 - thumbSize.value)
}

// The arrows jump straight to the very top (-1) or the very bottom (1) of the list.
function scrollStep(direction) {
  if (!canScroll.value) {
    moveIdleThumb(direction < 0 ? 0 : 100)
    return
  }
  const el = listEl.value
  el?.scrollTo({ top: direction < 0 ? 0 : el.scrollHeight, behavior: 'smooth' })
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

// Dragging the handle: moving it the full free length of the track scrolls the whole list.
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

// The panel fills the screen: from where it starts down to the bottom, leaving room for the
// total line under it, so the total is always on screen without scrolling the page.
const panelEl = ref(null)
const countEl = ref(null)
const panelHeight = ref(0)
const PANEL_MIN = 256
const PANEL_BOTTOM_GAP = 24

function fitPanel() {
  const panel = panelEl.value
  if (!panel) {
    return
  }
  const top = panel.getBoundingClientRect().top + window.scrollY
  const count = countEl.value ? countEl.value.offsetHeight + parseFloat(getComputedStyle(countEl.value).marginTop) : 0
  panelHeight.value = Math.max(window.innerHeight - top - count - PANEL_BOTTOM_GAP, PANEL_MIN)
}

watch(panelEl, function (el) {
  if (el) {
    nextTick(fitPanel)
  }
})

onMounted(function () {
  window.addEventListener('resize', fitPanel)
})

let barObserver = null

watch(listEl, function (el) {
  barObserver?.disconnect()
  if (el) {
    barObserver = new ResizeObserver(updateBar)
    barObserver.observe(el)
    nextTick(updateBar)
  }
})

watch(shownFriends, function () {
  nextTick(updateBar)
})

onBeforeUnmount(function () {
  barObserver?.disconnect()
  window.removeEventListener('resize', fitPanel)
})
watch(myUid, load)

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
    console.log('[Friends] request sent to', result.username)
  } catch (err) {
    console.warn('[Friends] send request failed:', err.message)
  } finally {
    actionLoading.value[result.pairKey] = false
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
  <div v-if="user">

    <div class="friends-layout">

      <!-- ── Main: friends list ── -->
      <div class="friends-main">
        <h1 class="fd-page-title">Friend List</h1>
        <p class="fd-page-subtitle mb-4">Your friends on FastDeal. Search to find one.</p>

        <div v-if="loadingFriends" class="text-secondary">
          <FdLoadingDots size="inline" message="Loading friends" />
        </div>

        <div v-else-if="friends.length === 0" class="empty-state">
          <FdIcon name="friends" class="empty-icon" />
          <p class="empty-text">No friends yet. Use Add Friend to find someone by username.</p>
        </div>

        <template v-else>
          <!-- Same pill as the Wishlist search. -->
          <div class="friend-search mb-3">
            <input v-model="friendQuery" class="friend-search-input" type="text" placeholder="Search your friends"
              aria-label="Search your friends by username or email" autocomplete="off" />
            <span class="friend-search-icon" aria-hidden="true">
              <FdIcon name="search" />
            </span>
          </div>

          <p v-if="!shownFriends.length" class="alert alert-secondary">No friends match "{{ friendQuery }}".</p>

          <div v-else ref="panelEl" class="friends-panel" :style="panelHeight ? { height: panelHeight + 'px' } : null">
            <div ref="listEl" class="friends-grid" tabindex="0" aria-label="Your friends" @scroll="updateBar">
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
          <p ref="countEl" class="friend-count">{{ friendCount }}</p>
        </template>
      </div>

      <!-- ── Sidebar: search + pending requests ── -->
      <aside class="friends-sidebar">

        <!-- Search -->
        <div class="sidebar-section">
          <h2 class="fd-section-title mb-2">Add Friend</h2>
          <div class="search-row">
            <input
              v-model="searchQuery"
              class="form-control"
              type="text"
              placeholder="Type a username…"
            />
            <FdLoadingDots v-if="searching" size="inline" message="Searching" class="text-secondary ms-1" />
          </div>

          <div v-if="searchResults.length" class="search-results mt-2">
            <div v-for="r in searchResults" :key="r.pairKey" class="search-result-row">
              <div class="search-avatar">{{ initials(r) }}</div>
              <div class="search-info">
                <div class="search-username">{{ r.username }}</div>
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

          <!-- Pending incoming requests — always shown below search results -->
          <div>
            <hr class="my-3" />
            <p class="fd-section-subtitle mb-2">
              Friend Requests
              <span class="request-badge">{{ requests.length }}</span>
            </p>
            <div v-if="requests.length" class="request-list">
              <div v-for="req in requests" :key="req.pairKey" class="request-row">
                <div class="friend-avatar small-avatar">{{ initials(req) }}</div>
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
            <p v-else class="small text-secondary mb-0">No pending requests.</p>
          </div>
        </div>

      </aside>
    </div>

  </div>
</template>

<style scoped>
/* Friend search: the same pill as the Wishlist search. */
.friend-search {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-height: var(--fd-control);
  padding: 0.25rem 0.25rem 0.25rem 1.5rem;
  border: var(--fd-border) solid var(--fd-vanilla-line);
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

.friend-search-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  color: var(--fd-blue);
}

.friends-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 2rem;
  align-items: start;
}

@media (max-width: 768px) {
  .friends-layout {
    grid-template-columns: 1fr;
  }
}

/* Friends grid */
/* The list sits in a paper panel, like every card, with the custom scrollbar on its right.
   Once the list is taller than about two thirds of the screen, it scrolls inside the panel. */
.friends-panel {
  display: flex;
  gap: 0.5rem;
  /* Height is set by fitPanel(): the rest of the screen, minus the total line under it. */
  min-height: 16rem;
  padding: 1rem;
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: var(--fd-radius);
  background: var(--fd-paper);
}

/* tabindex lets keyboard users scroll it; the browser's own scrollbar is hidden for ours. */
.friends-grid {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.friends-grid::-webkit-scrollbar {
  display: none;
}

/* Scrollbar: an arrow at each end and a track with a handle to drag. */
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

/* The handle is blue and a little wider than its track, so it is easy to see and grab. */
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


/* The total under the list: muted, above a vanilla line, like the Wishlist's. */
.friend-count {
  margin: 0.75rem 0 0;
  padding-top: 0.75rem;
  border-top: var(--fd-border) solid var(--fd-vanilla-line);
  color: var(--fd-text-muted);
  text-align: right;
}

.friends-grid:focus-visible {
  outline: 3px solid var(--fd-blue);
  outline-offset: 3px;
}

/* The cards keep their size; the panel scrolls instead of squeezing them. */
.friends-grid > .friend-card {
  flex-shrink: 0;
}

.friend-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  border: 2px solid var(--fd-vanilla-line);
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

.small-avatar {
  width: 36px;
  height: 36px;
  font-size: var(--fd-small);
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

/* Sidebar */
.friends-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.sidebar-section {
  padding: 1rem;
  border: 2px solid var(--fd-vanilla-line);
  border-radius: var(--fd-radius);
  background: var(--fd-paper);
}

.search-row {
  display: flex;
  gap: 0.5rem;
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.search-result-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--fd-vanilla-line);
}

.search-result-row:last-child {
  border-bottom: none;
}

.search-avatar {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--fd-vanilla-soft);
  color: var(--fd-blue);
  font-family: var(--fd-font-body);
  font-size: var(--fd-small);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--fd-vanilla-line);
}

.search-info {
  flex: 1;
  min-width: 0;
}

.search-username {
  font-weight: 700;
  font-size: var(--fd-small);
  color: var(--fd-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-email {
  font-size: var(--fd-small);
  color: var(--fd-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  border: 1.5px solid var(--fd-vanilla-line);
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

.request-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.request-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}
</style>
