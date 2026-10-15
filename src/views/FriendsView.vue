<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { user, firebaseUser } from '../mock/session.js'
import {
  getFriends,
  getIncomingRequests,
  searchUsers,
  sendRequest,
  acceptRequest,
  declineOrRemove
} from '../services/friendsApi.js'
import FdIcon from '../components/FdIcon.vue'

const router = useRouter()

if (!user.value) {
  router.replace('/login?next=/friends')
}

const friends = ref([])
const requests = ref([])
const searchQuery = ref('')
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
      getFriends(myUid.value),       // GET /api/friends
      getIncomingRequests(myUid.value) // GET /api/friends/requests
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
      allSearchResults.value = await searchUsers(q.trim(), myUid.value)
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
    await sendRequest(myUid.value, result.firebaseUid)
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
    await acceptRequest(req.pairKey, myUid.value)
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
    await declineOrRemove(req.pairKey, myUid.value)
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
    await declineOrRemove(friend.pairKey, myUid.value)
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
  <div v-if="user" class="fd-page">
    <div class="container-xl">

      <div class="friends-layout">

        <!-- ── Main: friends list ── -->
        <div class="friends-main">
          <h1 class="fd-page-title mb-1">Friend List</h1>
          <p class="fd-page-subtitle mb-4">
            {{ friends.length }} {{ friends.length === 1 ? 'friend' : 'friends' }}
          </p>

          <div v-if="loadingFriends" class="text-secondary small">Loading…</div>

          <div v-else-if="friends.length === 0" class="empty-state">
            <FdIcon name="friends" class="empty-icon" />
            <p class="empty-text">No friends yet. Search for someone by username.</p>
          </div>

          <div v-else class="friends-grid">
            <div v-for="f in friends" :key="f.pairKey" class="friend-card">
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
        </div>

        <!-- ── Sidebar: search + pending requests ── -->
        <aside class="friends-sidebar">

          <!-- Search -->
          <div class="sidebar-section">
            <h2 class="fd-section-subtitle mb-2">Add Friend</h2>
            <div class="search-row">
              <input
                v-model="searchQuery"
                class="form-control"
                type="text"
                placeholder="Type a username…"
              />
              <span v-if="searching" class="small text-secondary ms-1">…</span>
            </div>

            <div v-if="searchResults.length" class="search-results mt-2">
              <div v-for="r in searchResults" :key="r.pairKey" class="search-result-row">
                <div class="search-avatar">{{ initials(r) }}</div>
                <div class="search-info">
                  <div class="search-username">{{ r.username }}</div>
                  <div class="search-email">{{ r.email }}</div>
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
  </div>
</template>

<style scoped>
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
.friends-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
  font-family: var(--fd-font-display);
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.small-avatar {
  width: 36px;
  height: 36px;
  font-size: 0.8rem;
}

.friend-info {
  flex: 1;
  min-width: 0;
}

.friend-username {
  font-weight: 700;
  font-size: 0.9375rem;
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
  font-family: var(--fd-font-display);
  font-size: 0.8rem;
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
  font-size: 0.875rem;
  color: var(--fd-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-email {
  font-size: 0.75rem;
  color: var(--fd-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-action {
  flex-shrink: 0;
}

.badge-friends {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: var(--fd-green-soft);
  color: var(--fd-ink);
}

.badge-pending {
  font-size: 0.75rem;
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
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--fd-blue);
  color: var(--fd-beige);
  font-size: 0.7rem;
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
