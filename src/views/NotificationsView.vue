<script setup>
import { useRouter } from 'vue-router'
import { user, firebaseUser } from '../mock/session.js'
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const router = useRouter()
const notifications = ref([])
const unread = ref([])
const read = ref([])
const myUid = computed(() => firebaseUser.value?.uid)

// Buy Together popup state
const buyTogetherOpen = ref(false)
const buyTogetherFriends = ref([])
const buyTogetherProduct = ref('')
const buyTogetherLoading = ref(false)

if (!user.value) {
  router.replace('/login?next=/notifications')
}

async function load() {
  const res = await axios.get('/api/notifications', { params: { id: myUid.value } })
  notifications.value = res.data
  unreadSplit()
}

async function markRead(n) {
  await axios.put('/api/notifications/' + n._id + '/read')
  n.read = true
  unreadSplit()
}

function unreadSplit() {
  unread.value = []
  read.value = []
  for (const i of notifications.value) {
    if (i.read == false) {
      unread.value.push(i)
    } else if (read.value.length <= 15) {
      read.value.push(i)
    }
  }
}

async function markAllRead() {
  await axios.put('/api/notifications/read-all', null, { params: { id: myUid.value } })
  notifications.value.forEach(n => { n.read = true })
  unreadSplit()
}

async function openBuyTogether(n) {
  buyTogetherProduct.value = n.productKey || ''
  buyTogetherFriends.value = []
  buyTogetherLoading.value = true
  buyTogetherOpen.value = true
  try {
    const res = await axios.get('/api/buy-together', {
      params: { myUid: myUid.value, productName: n.productKey || '' }
    })
    buyTogetherFriends.value = res.data
  } catch (err) {
    console.error('[Buy Together]', err)
  } finally {
    buyTogetherLoading.value = false
  }
  if (!n.read) markRead(n)
}

function closeBuyTogether() {
  buyTogetherOpen.value = false
}

onMounted(load)
</script>

<template>
  <div v-if="user">
    <div class="d-flex justify-content-between gap-3">
      <h1 class="fd-section-title" style="margin: 0;">Notifications</h1>
      <button class="btn btn-sm btn-outline-dark" type="button" @click="markAllRead">Mark all as read</button>
    </div>

    <div>
      <h2 class="fd-section-subtitle">Unread</h2>
      <div class="row g-3">
        <div class="col-12" v-for="n in unread" :key="n._id">
          <!-- Buy Together notification -->
          <div v-if="n.type === 'group-order'" class="card h-100" style="padding: 0.75rem; border-color: var(--fd-blue);">
            <div class="d-flex justify-content-between align-items-center gap-2">
              <div>
                <h5 class="card-title" style="margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.3;">🛒 {{ n.title }}</h5>
                <p class="text-secondary" style="margin: 0;">{{ n.body }}</p>
              </div>
              <div class="d-flex gap-2 flex-shrink-0">
                <button class="btn btn-sm btn-dark" type="button" @click="openBuyTogether(n)">Buy Together</button>
                <button class="btn btn-sm btn-outline-dark" type="button" @click.prevent="markRead(n)">Dismiss</button>
              </div>
            </div>
          </div>

          <!-- Regular notification -->
          <router-link v-else :to="n.link || '/'" style="text-decoration: none;">
            <div class="card h-100" style="padding: 0.75rem; border-radius: 1rem;">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h5 class="card-title" style="margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.3;">{{ n.title }}</h5>
                  <p style="margin: 0;">{{ n.body }}</p>
                </div>
                <button class="btn btn-sm btn-outline-dark" type="button" @click.prevent="markRead(n)">Mark as read</button>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <hr>
    <div>
      <h2 class="fd-section-subtitle">Read</h2>
      <div class="row g-3">
        <div class="col-12" v-for="n in read" :key="n._id">
          <div v-if="n.type === 'group-order'" class="card h-100" style="padding: 0.75rem;">
            <div class="d-flex justify-content-between align-items-center gap-2">
              <div>
                <h5 class="card-title" style="margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.3;">🛒 {{ n.title }}</h5>
                <p class="text-secondary" style="margin: 0;">{{ n.body }}</p>
              </div>
              <button class="btn btn-sm btn-outline-dark flex-shrink-0" type="button" @click="openBuyTogether(n)">Buy Together</button>
            </div>
          </div>
          <router-link v-else :to="n.link || '/'" style="text-decoration: none;">
            <div class="card h-100" style="padding: 0.75rem; border-radius: 1rem;">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h5 class="card-title" style="margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.3;">{{ n.title }}</h5>
                  <p style="margin: 0;">{{ n.body }}</p>
                </div>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Buy Together popup — uses the same .fd-entry-backdrop / .fd-entry-dialog as Login/Signup -->
    <div v-if="buyTogetherOpen" class="fd-entry-backdrop" @click.self="closeBuyTogether">
      <div class="fd-entry-dialog">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div>
            <p class="fd-eyebrow mb-1">Buy Together</p>
            <p class="small text-secondary mb-0">Friends who also saved <strong>{{ buyTogetherProduct }}</strong></p>
          </div>
          <button type="button" class="btn-close" @click="closeBuyTogether" aria-label="Close"></button>
        </div>

        <div v-if="buyTogetherLoading" class="text-center py-3 text-secondary small">Loading…</div>

        <div v-else-if="buyTogetherFriends.length === 0" class="text-center py-3 text-secondary small">
          No friends have this item saved right now.
        </div>

        <ul v-else class="list-unstyled mb-0">
          <li v-for="f in buyTogetherFriends" :key="f.username" class="d-flex justify-content-between align-items-center py-2" style="border-bottom: 2px solid var(--fd-vanilla-line);">
            <span class="fw-bold" style="font-family: var(--fd-font-display); letter-spacing: 0.04em;">{{ f.username.toUpperCase() }}</span>
            <span v-if="f.telegramUsername" class="small fw-bold" style="color: var(--fd-blue);">@{{ f.telegramUsername }}</span>
            <span v-else class="small text-secondary">No Telegram set</span>
          </li>
        </ul>

        <p class="small text-secondary mt-3 mb-0">Message them on Telegram to coordinate your order.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* group-order card accent uses fd-blue border, matching the app's card style */
.bt-card {
  border-color: var(--fd-blue) !important;
}
</style>
