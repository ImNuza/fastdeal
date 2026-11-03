<script setup>
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
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
import FdAvatar from '../components/FdAvatar.vue'
import FdLoadingDots from '../components/FdLoadingDots.vue'
import FdConfirmDialog from '../components/FdConfirmDialog.vue'
import FdTabs from '../components/FdTabs.vue'
import FdListSearch from '../components/FdListSearch.vue'
import FdScrollArea from '../components/FdScrollArea.vue'
import FdEmptyState from '../components/FdEmptyState.vue'
import FdTotalBar from '../components/FdTotalBar.vue'
import FdPager from '../components/FdPager.vue'
import { useListPages } from '../services/listPages.js'

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
const errorText = ref('') // shown at the top of the tab panel when an action fails
const confirmFriend = ref(null) // the friend whose Remove waits for a Yes in the pop-up
const removeError = ref('') // shown inside the pop-up when the remove fails

const myUid = computed(() => firebaseUser.value?.uid)

// Fetch both the friends list and incoming requests in parallel on page load.
async function load() {
  if (!myUid.value) return
  loadingFriends.value = true
  errorText.value = ''
  try {
    const [f, r, sentList] = await Promise.all([
      getFriends(),       // GET /api/friends
      getIncomingRequests(), // GET /api/friends/requests
      getSentRequests()   // GET /api/friends/sent
    ])
    friends.value = f
    requests.value = r
    sent.value = sentList
  } catch (err) {
    errorText.value = 'Could not load your friends. Try again.'
  } finally {
    loadingFriends.value = false
  }
}

onMounted(load)

// New requests show up while the page is open, like the bell in the navbar: every 5 seconds the
// friends and both request lists are fetched again, so the count bubble on the Requests tab
// appears by itself, and someone who accepts your request moves into Friends. Search boxes and
// scrolling are left alone.
const REQUEST_CHECK_MS = 5000
let requestTimer = 0

async function refreshRequests() {
  if (!myUid.value || document.hidden) {
    return
  }
  try {
    const [f, r, sentList] = await Promise.all([getFriends({ quiet: true }), getIncomingRequests({ quiet: true }), getSentRequests({ quiet: true })])
    friends.value = f
    requests.value = r
    sent.value = sentList
  } catch (err) {
    // A missed check is fine: the next one tries again.
  }
}

onMounted(function () {
  requestTimer = window.setInterval(refreshRequests, REQUEST_CHECK_MS)
})

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

// Requests carries the count bubble of requests waiting for you.
const tabs = computed(function () {
  return TABS.map(function (t) {
    return t.id === 'requests' ? { ...t, count: requests.value.length } : t
  })
})

// The tab card (for the pager to scroll back to) and the scrolling list inside it
const tabsCard = ref(null)
const scrollArea = ref(null)

watch(myUid, load)

// A new tab starts at the top of its list.
watch(activeTab, function () {
  scrollArea.value?.toTop()
})

onBeforeUnmount(function () {
  window.clearInterval(requestTimer)
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
    errorText.value = ''
    try {
      allSearchResults.value = await searchUsers(q.trim())
    } catch (err) {
      errorText.value = 'Could not search. Try again.'
    } finally {
      searching.value = false
    }
  }, 300)
})

// POST /api/friends/request — creates a pending friendship row in MongoDB.
// Mutate allSearchResults so the computed searchResults re-filters and the button updates.
async function onSendRequest(result) {
  actionLoading.value[result.pairKey] = true
  errorText.value = ''
  try {
    await sendRequest(result.firebaseUid)
    const hit = allSearchResults.value.find(r => r.pairKey === result.pairKey)
    if (hit) { hit.friendshipStatus = 'pending'; hit.iRequested = true }
    sent.value.push({ pairKey: result.pairKey, firebaseUid: result.firebaseUid, username: result.username })
  } catch (err) {
    errorText.value = 'Could not send the request. Try again.'
  } finally {
    actionLoading.value[result.pairKey] = false
  }
}

// DELETE /api/friends/:pairKey on a request I sent: takes it back.
async function onCancel(req) {
  actionLoading.value[req.pairKey] = true
  errorText.value = ''
  try {
    await declineOrRemove(req.pairKey)
    sent.value = sent.value.filter(r => r.pairKey !== req.pairKey)
    const hit = allSearchResults.value.find(r => r.pairKey === req.pairKey)
    if (hit) { hit.friendshipStatus = null; hit.iRequested = null }
  } catch (err) {
    errorText.value = 'Could not cancel the request. Try again.'
  } finally {
    actionLoading.value[req.pairKey] = false
  }
}

// PUT /api/friends/:pairKey/accept — sets status to 'accepted'.
// Move the accepted user out of requests and into the friends list locally.
async function onAccept(req) {
  actionLoading.value[req.pairKey] = true
  errorText.value = ''
  try {
    await acceptRequest(req.pairKey)
    requests.value = requests.value.filter(r => r.pairKey !== req.pairKey)
    friends.value.push(req)
    const hit = allSearchResults.value.find(r => r.pairKey === req.pairKey)
    if (hit) hit.friendshipStatus = 'accepted'
  } catch (err) {
    errorText.value = 'Could not accept the request. Try again.'
  } finally {
    actionLoading.value[req.pairKey] = false
  }
}

// DELETE /api/friends/:pairKey — removes the friendship row entirely (decline or cancel).
async function onDecline(req) {
  actionLoading.value[req.pairKey] = true
  errorText.value = ''
  try {
    await declineOrRemove(req.pairKey)
    requests.value = requests.value.filter(r => r.pairKey !== req.pairKey)
    const hit = allSearchResults.value.find(r => r.pairKey === req.pairKey)
    if (hit) { hit.friendshipStatus = null; hit.iRequested = null }
  } catch (err) {
    errorText.value = 'Could not decline the request. Try again.'
  } finally {
    actionLoading.value[req.pairKey] = false
  }
}

// DELETE /api/friends/:pairKey — same endpoint, but used on an existing friend to unfriend.
async function onRemove(friend) {
  actionLoading.value[friend.pairKey] = true
  removeError.value = ''
  try {
    await declineOrRemove(friend.pairKey)
    friends.value = friends.value.filter(f => f.pairKey !== friend.pairKey)
    const hit = allSearchResults.value.find(r => r.pairKey === friend.pairKey)
    if (hit) { hit.friendshipStatus = null; hit.iRequested = null }
    confirmFriend.value = null
  } catch (err) {
    removeError.value = 'Could not remove the friend. Try again.'
  } finally {
    actionLoading.value[friend.pairKey] = false
  }
}

function askRemove(friend) {
  removeError.value = ''
  confirmFriend.value = friend
}

function initials(f) {
  const name = f.username || f.email || '?'
  return name.slice(0, 2).toUpperCase()
}

// 8 rows a page on every screen, with the page buttons in the bar under the list.
const { page: listPage, pageCount: listPageCount, pageRows, rowCount: listTotal } = useListPages(
  function () {
    if (activeTab.value === 'friends') return shownFriends.value
    if (activeTab.value === 'add') return searchQuery.value.trim() ? searchResults.value : sent.value
    return requests.value
  },
  [activeTab, friendQuery, searchQuery]
)
</script>

<template>
  <!-- App.vue already wraps every page in the standard container (.fd-page), so no extra one here. -->
  <div v-if="user" class="fd-list-page">

    <h1 class="fd-page-title">Friend List</h1>
    <p class="fd-page-subtitle">Add friends by their username. If you both want the same thing, buy it together and split the shipping.</p>

    <!-- The open tab and the card under it are one piece, like a folder tab. -->
    <FdTabs ref="tabsCard" v-model="activeTab" :tabs="tabs" label="Friends">
      <p v-if="errorText" class="alert alert-danger" role="alert">{{ errorText }}</p>
      <!-- The search sits above the scrolling list, so the list and its scrollbar start together
           under it. -->
      <div v-if="activeTab === 'friends' && !loadingFriends && friends.length" class="fd-list-tools">
        <FdListSearch v-model="friendQuery" placeholder="Search your friends" label="Search your friends by username or email" />
      </div>
      <div v-else-if="activeTab === 'add'" class="fd-list-tools">
        <FdListSearch v-model="searchQuery" placeholder="Type a username" label="Search people by username" :busy="searching" />
      </div>

      <FdScrollArea ref="scrollArea" fill label="Friends content" :bar="(activeTab === 'friends' ? friends.length : listTotal) > 0">
        <!-- Friends -->
        <section v-if="activeTab === 'friends'">
          <div v-if="loadingFriends" class="text-secondary">
            <FdLoadingDots size="inline" message="Loading friends" />
          </div>

          <FdEmptyState v-else-if="friends.length === 0" icon="friends">
            No friends yet. Open Add Friend to find someone by username.
          </FdEmptyState>

          <template v-else>

            <p v-if="!shownFriends.length" class="alert alert-secondary">No friends match "{{ friendQuery }}".</p>

            <div v-else class="friend-rows">
              <div v-for="f in pageRows" :key="f.pairKey" class="friend-card">
                <FdAvatar>{{ initials(f) }}</FdAvatar>
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
                  @click="askRemove(f)"
                >
                  <FdIcon name="trash" />
                </button>
              </div>
            </div>
          </template>
        </section>

        <!-- Add Friend -->
        <section v-else-if="activeTab === 'add'">
          <!-- Before anything is typed: the requests you sent that are still waiting. -->
          <template v-if="!searchQuery.trim()">
            <div v-if="sent.length" class="friend-rows">
              <div v-for="req in pageRows" :key="req.pairKey" class="friend-card">
                <FdAvatar>{{ initials(req) }}</FdAvatar>
                <div class="friend-info">
                  <div class="friend-username">{{ req.username }}</div>
                  <div class="friend-email">has not answered yet</div>
                </div>
                <div class="friend-actions">
                  <span class="badge-pending">Pending</span>
                  <button
                    class="btn btn-outline-dark btn-sm"
                    type="button"
                    :disabled="actionLoading[req.pairKey]"
                    :aria-label="'Cancel the request to ' + req.username"
                    @click="onCancel(req)"
                  >Cancel</button>
                </div>
              </div>
            </div>
            <p v-else class="friend-group-empty">No pending requests. Type a username to find someone.</p>
          </template>

          <!-- Once something is typed: the matching people. -->
          <div v-else-if="searchResults.length" class="friend-rows">
            <div v-for="r in pageRows" :key="r.pairKey" class="friend-card">
              <FdAvatar>{{ initials(r) }}</FdAvatar>
              <div class="friend-info">
                <div class="friend-username">{{ r.username }}</div>
              </div>
              <div class="search-action">
                <span v-if="r.friendshipStatus === 'accepted'" class="badge-friends">Friends</span>
                <div v-else-if="r.friendshipStatus === 'pending' && r.iRequested" class="friend-actions">
                  <span class="badge-pending">Pending</span>
                  <button
                    class="btn btn-outline-dark btn-sm"
                    type="button"
                    :disabled="actionLoading[r.pairKey]"
                    :aria-label="'Cancel the request to ' + r.username"
                    @click="onCancel(r)"
                  >Cancel</button>
                </div>
                <div v-else-if="r.friendshipStatus === 'pending' && !r.iRequested" class="friend-actions">
                  <button class="btn btn-dark btn-sm" type="button" :disabled="actionLoading[r.pairKey]" @click="onAccept(r)">Accept</button>
                  <button class="btn btn-outline-dark btn-sm" type="button" :disabled="actionLoading[r.pairKey]" :aria-label="'Decline ' + r.username" @click="onDecline(r)">Decline</button>
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
        <section v-else>
          <div v-if="requests.length" class="friend-rows">
            <div v-for="req in pageRows" :key="req.pairKey" class="friend-card">
              <FdAvatar>{{ initials(req) }}</FdAvatar>
              <div class="friend-info">
                <div class="friend-username">{{ req.username || req.email }}</div>
                <div class="friend-email">wants to be friends</div>
              </div>
              <div class="friend-actions">
                <button
                  class="btn btn-dark btn-sm"
                  type="button"
                  :disabled="actionLoading[req.pairKey]"
                  @click="onAccept(req)"
                >Accept</button>
                <button
                  class="btn btn-outline-dark btn-sm"
                  type="button"
                  :disabled="actionLoading[req.pairKey]"
                  :aria-label="'Decline ' + (req.username || req.email)"
                  @click="onDecline(req)"
                >Decline</button>
              </div>
            </div>
          </div>
          <FdEmptyState v-else icon="bell">No requests waiting.</FdEmptyState>
        </section>
      </FdScrollArea>
    </FdTabs>

    <!-- Sticks to the bottom of the screen while scrolling, like the Wishlist's total bar. -->
    <FdTotalBar v-if="listTotal > 0" stacked>
      <FdPager v-model="listPage" :page-count="listPageCount" :total="listTotal" :noun="activeTab === 'friends' ? 'friends' : activeTab === 'requests' ? 'requests' : searchQuery.trim() ? 'people' : 'pending requests'" label="Friends" :top="tabsCard?.panel" />
    </FdTotalBar>
  </div>

  <FdConfirmDialog
    v-if="confirmFriend"
    title="Remove friend"
    confirm-label="Remove"
    danger
    :busy="actionLoading[confirmFriend.pairKey]"
    :error="removeError"
    @confirm="onRemove(confirmFriend)"
    @cancel="confirmFriend = null"
  >
    Remove <strong>{{ confirmFriend.username || confirmFriend.email }}</strong> from your friends?
    You can send a new request later.
  </FdConfirmDialog>
</template>

<style scoped>
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

/* One card per row, 12px apart, like the Wishlist; the page itself scrolls. */
.friend-rows {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.friend-card {
  flex-shrink: 0;
}

.friend-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: var(--fd-radius);
  background: var(--fd-paper);
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

.search-result-row:last-child {
  border-bottom: none;
}

/* The buttons and tags at the end of a card (Accept and Decline, Pending and Cancel): one
   group, always the same 8px apart. */
.friend-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.5rem;
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
</style>
