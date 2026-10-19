<script setup>
import { useRouter } from 'vue-router'
import { user,firebaseUser } from '../mock/session.js'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'

const router = useRouter()
const notifications=ref([])
const unread=ref([])
const read=ref([])
const myUid = computed(() => firebaseUser.value?.uid)

if (!user.value) {
  router.replace('/login?next=/notifications')
}

async function load() {
  const res=await axios.get('/api/notifications' , { params: { id: myUid.value } })
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
  await axios.put('/api/notifications/read-all', null, { params: { id: myUid.value } })
  notifications.value.forEach(n => { n.read = true })
  unreadSplit()
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
        <div class="col-12" v-for="n in unread">
          <router-link :to="n.link || '/'" style="text-decoration: none;">
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
                </div>
              </div>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>
