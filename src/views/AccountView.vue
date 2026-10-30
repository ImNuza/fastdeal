<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../store/auth.js'
import { signOutUser } from '../services/auth.js'
import { updateUser } from '../services/userApi.js'
import FdIcon from '../components/FdIcon.vue'

const router = useRouter()
const authStore = useAuthStore()
const { user, authReady } = storeToRefs(authStore)
const { toggleEmail } = authStore

watch(authReady, (ready) => {
  if (ready && !user.value) router.replace('/login?next=/account')
}, { immediate: true })

// Account details, read only: the username, the email when there is one, and the join date
const details = computed(function () {
  if (!user.value) return []
  const rows = [{ label: 'Username', value: user.value.username ? '@' + user.value.username : 'Not set' }]
  if (user.value.email) rows.push({ label: 'Email', value: user.value.email })
  if (user.value.createdAt) {
    rows.push({
      label: 'Member since',
      value: new Date(user.value.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
    })
  }
  return rows
})

const initials = computed(function () {
  const name = user.value?.username || user.value?.email || '?'
  return name.slice(0, 2).toUpperCase()
})

async function onLogout() {
  await signOutUser()
  router.push('/')
}

// Telegram username editing
const telegramInput = ref('')
const telegramError = ref('')
const telegramSuccess = ref(false)
const telegramLoading = ref(false)
const TELEGRAM_RE = /^[A-Za-z0-9_]{5,32}$/

watch(user, (u) => {
  if (u) telegramInput.value = u.telegramUsername || ''
}, { immediate: true })

async function saveTelegram() {
  telegramError.value = ''
  telegramSuccess.value = false
  const handle = telegramInput.value.trim().replace(/^@/, '')
  if (handle && !TELEGRAM_RE.test(handle)) {
    telegramError.value = 'Must be 5–32 characters: letters, numbers or _.'
    return
  }
  telegramLoading.value = true
  try {
    const dbUser = await updateUser({ telegramUsername: handle || null })
    if (user.value) user.value.telegramUsername = dbUser.telegramUsername || null
    telegramSuccess.value = true
    setTimeout(() => { telegramSuccess.value = false }, 2500)
  } catch (err) {
    telegramError.value = err.response?.data?.error || err.message || 'Could not save.'
  } finally {
    telegramLoading.value = false
  }
}
</script>

<template>
  <div v-if="user">
    <h1 class="fd-page-title">Account</h1>

    <!-- Account details: read only, with a lock on the ones that cannot be changed here -->
    <section class="mt-4">
      <h2 class="fd-section-title">Account details</h2>
      <div class="card fd-account-card">
        <div class="fd-account-head">
          <span class="fd-account-avatar" aria-hidden="true">{{ initials }}</span>
          <div class="fd-account-who">
            <p class="fd-section-subtitle mb-0">
              {{ user.username || user.email }}
              <span v-if="user.role === 'admin'" class="fd-account-tag">Admin</span>
            </p>
            <p v-if="user.email" class="small text-secondary mb-0">{{ user.email }}</p>
          </div>
        </div>

        <dl class="fd-account-list">
          <div v-for="d in details" :key="d.label" class="fd-account-row">
            <dt>{{ d.label }}</dt>
            <dd>
              {{ d.value }}
              <span class="fd-account-lock" title="Cannot be changed here">
                <FdIcon name="lock" />
                <span class="visually-hidden">Cannot be changed here</span>
              </span>
            </dd>
          </div>
        </dl>

        <!-- Telegram: the one detail you can change here -->
        <div class="fd-account-telegram">
          <label class="fd-account-label" for="tg-account">Telegram username</label>
          <p class="small text-secondary mb-2">Shared only with friends who want to Buy Together on the same item.</p>
          <div class="input-group">
            <span class="input-group-text">@</span>
            <input
              id="tg-account"
              v-model="telegramInput"
              class="form-control"
              type="text"
              placeholder="yourtelegram"
              autocomplete="off"
              @keyup.enter="saveTelegram"
            />
            <button class="btn btn-dark" type="button" :disabled="telegramLoading" @click="saveTelegram">
              {{ telegramLoading ? 'Saving…' : 'Save' }}
            </button>
          </div>
          <p v-if="telegramError" class="small text-danger mt-2 mb-0">{{ telegramError }}</p>
          <p v-if="telegramSuccess" class="small text-success mt-2 mb-0">Saved!</p>
        </div>
      </div>
    </section>

    <section class="mt-5">
      <h2 class="fd-section-title">Settings</h2>
      <div class="card p-3">
        <div class="form-check form-switch mb-0">
          <input id="emailOn" class="form-check-input" type="checkbox" :checked="user.emailOn" @change="toggleEmail" />
          <label class="form-check-label" for="emailOn">Email me when a saved price drops</label>
        </div>
      </div>

    </section>

    <button class="btn btn-dark fd-btn-lg mt-4" type="button" @click="onLogout">Log out</button>
  </div>
</template>

<style scoped>
.fd-account-card {
  padding: 1.25rem;
}

.fd-account-head {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--fd-vanilla-line);
}

/* Same blue initials circle as the Friends and Admin pages */
.fd-account-avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: var(--fd-blue);
  color: var(--fd-beige);
  font-size: var(--fd-body);
  font-weight: 700;
}

.fd-account-who {
  min-width: 0;
}

.fd-account-tag {
  display: inline-block;
  margin-left: 0.375rem;
  padding: 0.0625rem 0.5rem;
  border-radius: 999px;
  background: var(--fd-vanilla);
  color: var(--fd-ink);
  font-size: var(--fd-small);
  font-weight: 700;
  line-height: 1.4;
  vertical-align: 0.0625rem;
}

.fd-account-list {
  margin: 0;
}

/* Label on the left, value on the right, a lock after values that cannot be changed */
.fd-account-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  padding: 0.75rem 0;
}

.fd-account-row + .fd-account-row {
  border-top: 1px solid var(--fd-vanilla-line);
}

.fd-account-row dt {
  color: var(--fd-text-muted);
  font-weight: 400;
}

.fd-account-row dd {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  margin: 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}

/* Telegram sits under the details, after the same divider */
.fd-account-telegram {
  padding-top: 0.75rem;
  border-top: 1px solid var(--fd-vanilla-line);
}

.fd-account-label {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--fd-text-muted);
}

.fd-account-lock {
  display: inline-flex;
  color: var(--fd-text-muted);
}

.fd-account-lock .fd-icon {
  width: 1rem;
  height: 1rem;
}
</style>
