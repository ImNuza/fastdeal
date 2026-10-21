<script setup>
import { useRouter } from 'vue-router'
import { user } from '../mock/session.js'
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import FdLoadingDots from '../components/FdLoadingDots.vue'

const router = useRouter()
const notifications=ref([])
const unread=ref([])
const read=ref([])

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


function unreadSplit(){
  unread.value = []
  read.value = []
  for (const i of notifications.value){
    if(i.read==false){
      unread.value.push(i)
    }else if (read.value.length<=15){
      read.value.push(i)
    }
  }
}

async function markAllRead() {
  await axios.put('/api/notifications/read-all')
  notifications.value.forEach(n => { n.read = true })
  unreadSplit()
}

onMounted(load)

// Buy Together: the server sends one of these when a Sleep on it timer ends and friends saved
// the same product. fromUid is null. A group order invite from a friend has fromUid set.
function isBuyTogether(n) {
  return n.type === 'group-order' && !n.fromUid && Boolean(n.productKey)
}

const buyItem = ref(null)
const buyFriends = ref([])
const buyLoading = ref(false)
const buyError = ref('')
const buyDialog = ref(null)

// The friends are read live, so someone who removed the product or the friendship is not shown.
async function openBuyTogether(n) {
  buyItem.value = n
  buyFriends.value = []
  buyError.value = ''
  buyLoading.value = true
  nextTick(() => buyDialog.value?.querySelector('.fd-entry-actions button')?.focus())
  try {
    const res = await axios.get('/api/buy-together', { params: { productKey: n.productKey } })
    buyFriends.value = res.data
  } catch (err) {
    buyError.value = err.response?.data?.error || 'Could not load your friends. Try again.'
  } finally {
    buyLoading.value = false
  }
}

function closeBuyTogether() {
  buyItem.value = null
}
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
        <div class="col-12" v-for="n in unread">
          <router-link :to="n.link || '/'" style="text-decoration: none;">
            <div class="card h-100" style="padding: 0.75rem; border-radius: 1rem;">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h5 class="card-title" style="margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.3;">{{ n.title }}</h5>
                  <p style="margin: 0;">{{ n.body }}</p>
                </div>
                <div class="d-flex flex-wrap gap-2">
                  <button v-if="isBuyTogether(n)" class="btn btn-sm btn-dark" type="button"
                    @click.prevent="openBuyTogether(n)">Buy together</button>
                  <button class="btn btn-sm btn-outline-dark" type="button" @click.prevent="markRead(n)">Mark as read</button>
                </div>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <hr>
    <div>
      <h2 class="fd-section-subtitle">Read</h2>

      <div>
        <div class="row g-3">
          <div class="col-12" v-for="n in read">
            <router-link :to="n.link || '/'" style="text-decoration: none;">
              <div class="card h-100" style="padding: 0.75rem; border-radius: 1rem;">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 class="card-title" style="margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.3;">{{ n.title }}</h5>
                    <p style="margin: 0;">{{ n.body }}</p>
                  </div>
                  <button v-if="isBuyTogether(n)" class="btn btn-sm btn-dark" type="button"
                    @click.prevent="openBuyTogether(n)">Buy together</button>
                </div>
              </div>
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Buy Together pop-up. Uses the welcome prompt's dialog styles from app.css. -->
    <div v-if="buyItem" class="fd-entry-backdrop" @click.self="closeBuyTogether" @keydown.esc="closeBuyTogether">
      <section ref="buyDialog" class="fd-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-buy-title">
        <h2 id="fd-buy-title" class="fd-page-title">Buy together</h2>
        <p class="fd-entry-description">These friends also saved this product. Message them to order together and
          split the shipping.</p>
        <FdLoadingDots v-if="buyLoading" size="inline" message="Finding your friends" />
        <p v-else-if="buyError" class="alert alert-danger" role="alert">{{ buyError }}</p>
        <p v-else-if="!buyFriends.length" class="text-secondary">None of your friends has this product saved now.</p>
        <ul v-else class="list-unstyled text-start mb-4">
          <li v-for="f in buyFriends" :key="f.username"
            class="d-flex justify-content-between align-items-center gap-2 py-2 border-bottom">
            <span class="fw-semibold">{{ f.username }}</span>
            <a v-if="f.telegramUsername" class="btn btn-sm btn-outline-dark" :href="'https://t.me/' + f.telegramUsername"
              target="_blank" rel="noopener">Message @{{ f.telegramUsername }}</a>
            <span v-else class="small text-secondary">No Telegram yet</span>
          </li>
        </ul>
        <div class="fd-entry-actions">
          <button class="btn btn-dark" type="button" @click="closeBuyTogether">Close</button>
        </div>
      </section>
    </div>
  </div>

</template>
