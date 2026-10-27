<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth.js'
import { storeToRefs } from 'pinia'
const { user } = storeToRefs(useAuthStore())
import { ref, nextTick, onMounted } from 'vue'
import axios from 'axios'
import FdLoadingDots from '../components/FdLoadingDots.vue'
import FdTelegramPrompt from '../components/FdTelegramPrompt.vue'

const showTelegramPrompt = ref(false)

const router = useRouter()
const notifications = ref([])
const unread = ref([])
const read = ref([])

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
  await axios.put('/api/notifications/read-all')
  notifications.value.forEach(n => { n.read = true })
  unreadSplit()
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
    inviterError.value = err.response?.data?.error || 'Could not load their profile.'
  } finally {
    inviterLoading.value = false
  }
  if (!n.read) markRead(n)
}

function closeGroupInvite() { inviteItem.value = null }

onMounted(load)
</script>

<template>
  <div v-if="user">
    <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
      <h1 class="fd-page-title" style="margin: 0;">Notifications</h1>
      <button class="btn btn-sm btn-outline-dark" type="button" @click="markAllRead">Mark all as read</button>
    </div>

    <!-- Unread -->
    <div>
      <h2 class="fd-section-title">Unread</h2>
      <div class="row g-3">
        <div class="col-12" v-for="n in unread" :key="n._id">

          <!-- Buy Together card (initiator) -->
          <div v-if="isBuyTogether(n)" class="card h-100 bt-card" style="padding: 0.75rem;">
            <div class="d-flex justify-content-between align-items-center gap-2">
              <div>
                <h5 class="card-title" style="margin: 0; font-size: var(--fd-body); font-weight: 600; line-height: 1.3;">🛒 {{ n.title }}</h5>
                <p class="text-secondary" style="margin: 0;">{{ n.body }}</p>
              </div>
              <div class="d-flex gap-2 flex-shrink-0">
                <button class="btn btn-sm btn-dark" type="button" @click="openBuyTogether(n)">Buy Together</button>
                <button class="btn btn-sm btn-outline-dark" type="button" @click.prevent="markRead(n)">Dismiss</button>
              </div>
            </div>
          </div>

          <!-- Group invite card (friend) -->
          <div v-else-if="isGroupInvite(n)" class="card h-100 bt-card" style="padding: 0.75rem;">
            <div class="d-flex justify-content-between align-items-center gap-2">
              <div>
                <h5 class="card-title" style="margin: 0; font-size: var(--fd-body); font-weight: 600; line-height: 1.3;">🛒 {{ n.title }}</h5>
                <p class="text-secondary" style="margin: 0;">{{ n.body }}</p>
              </div>
              <div class="d-flex gap-2 flex-shrink-0">
                <button class="btn btn-sm btn-dark" type="button" @click="openGroupInvite(n)">Buy Together</button>
                <button class="btn btn-sm btn-outline-dark" type="button" @click.prevent="markRead(n)">Dismiss</button>
              </div>
            </div>
          </div>

          <!-- Regular notification -->
          <router-link v-else :to="n.link || '/'" style="text-decoration: none;">
            <div class="card h-100" style="padding: 0.75rem; border-radius: 1rem;">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h5 class="card-title" style="margin: 0; font-size: var(--fd-body); font-weight: 600; line-height: 1.3;">{{ n.title }}</h5>
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

    <!-- Read -->
    <div>
      <h2 class="fd-section-title">Read</h2>
      <div class="row g-3">
        <div class="col-12" v-for="n in read" :key="n._id">
          <div v-if="isBuyTogether(n)" class="card h-100" style="padding: 0.75rem;">
            <div class="d-flex justify-content-between align-items-center gap-2">
              <div>
                <h5 class="card-title" style="margin: 0; font-size: var(--fd-body); font-weight: 600; line-height: 1.3;">🛒 {{ n.title }}</h5>
                <p class="text-secondary" style="margin: 0;">{{ n.body }}</p>
              </div>
              <button class="btn btn-sm btn-outline-dark flex-shrink-0" type="button" @click="openBuyTogether(n)">Buy Together</button>
            </div>
          </div>
          <div v-else-if="isGroupInvite(n)" class="card h-100" style="padding: 0.75rem;">
            <div class="d-flex justify-content-between align-items-center gap-2">
              <div>
                <h5 class="card-title" style="margin: 0; font-size: var(--fd-body); font-weight: 600; line-height: 1.3;">🛒 {{ n.title }}</h5>
                <p class="text-secondary" style="margin: 0;">{{ n.body }}</p>
              </div>
              <button class="btn btn-sm btn-outline-dark flex-shrink-0" type="button" @click="openGroupInvite(n)">View</button>
            </div>
          </div>
          <router-link v-else :to="n.link || '/'" style="text-decoration: none;">
            <div class="card h-100" style="padding: 0.75rem; border-radius: 1rem;">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h5 class="card-title" style="margin: 0; font-size: var(--fd-body); font-weight: 600; line-height: 1.3;">{{ n.title }}</h5>
                  <p style="margin: 0;">{{ n.body }}</p>
                </div>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <FdTelegramPrompt v-if="showTelegramPrompt" @close="showTelegramPrompt = false" />

    <!-- Popup A: initiator picks friends to invite -->
    <div v-if="buyItem" class="fd-entry-backdrop" @click.self="closeBuyTogether" @keydown.esc="closeBuyTogether">
      <section ref="buyDialog" class="fd-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-buy-title">
        <h2 id="fd-buy-title" class="fd-page-title">Buy together</h2>
        <p class="fd-entry-description">Select the friends you want to invite. They'll get a notification and can reach out to you.</p>

        <FdLoadingDots v-if="buyLoading" size="inline" message="Finding your friends" />
        <p v-else-if="buyError" class="alert alert-danger" role="alert">{{ buyError }}</p>
        <p v-else-if="!buyFriends.length" class="text-secondary">None of your friends has this product saved right now.</p>

        <ul v-else class="list-unstyled text-start mb-4">
          <li v-for="f in buyFriends" :key="f.firebaseUid"
            class="d-flex align-items-center gap-3 py-2 border-bottom">
            <input
              type="checkbox"
              class="form-check-input mt-0 flex-shrink-0"
              :id="'chk-' + f.firebaseUid"
              :checked="buySelected.has(f.firebaseUid)"
              @change="toggleSelect(f.firebaseUid)"
            />
            <label :for="'chk-' + f.firebaseUid" class="mb-0 flex-grow-1" style="cursor: pointer;">
              <span class="fw-bold" style="font-family: var(--fd-font-display); letter-spacing: 0.04em;">{{ f.username.toUpperCase() }}</span>
            </label>
          </li>
        </ul>

        <div v-if="buyInviteSent" class="alert alert-success mb-3">Invites sent!</div>

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

    <!-- Popup B: friend sees sender's telegram to coordinate -->
    <div v-if="inviteItem" class="fd-entry-backdrop" @click.self="closeGroupInvite" @keydown.esc="closeGroupInvite">
      <section ref="inviteDialog" class="fd-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-invite-title">
        <h2 id="fd-invite-title" class="fd-page-title">Buy together</h2>
        <p class="fd-entry-description">{{ inviteItem.body }}</p>

        <FdLoadingDots v-if="inviterLoading" size="inline" message="Loading their profile" />
        <p v-else-if="inviterError" class="alert alert-danger" role="alert">{{ inviterError }}</p>

        <div v-else-if="inviterProfile" class="d-flex align-items-center justify-content-between gap-3 py-3 mb-4 border-bottom border-top">
          <span class="fw-bold" style="font-family: var(--fd-font-display); letter-spacing: 0.04em; font-size: var(--fd-section-title);">
            {{ inviterProfile.username.toUpperCase() }}
          </span>
          <a v-if="inviterProfile.telegramUsername"
            class="btn btn-dark"
            :href="'https://t.me/' + inviterProfile.telegramUsername"
            target="_blank" rel="noopener">
            Message @{{ inviterProfile.telegramUsername }}
          </a>
          <span v-else class="small text-secondary">No Telegram set yet</span>
        </div>

        <div class="fd-entry-actions">
          <button class="btn btn-outline-dark" type="button" @click="closeGroupInvite">Close</button>
        </div>
      </section>
    </div>

  </div>
</template>

<style scoped>
.bt-card {
  border-color: var(--fd-blue) !important;
}
</style>
