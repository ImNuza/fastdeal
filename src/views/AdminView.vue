<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAdminStore } from '../store/admin.js'
import { useAuthStore } from '../store/auth.js'
import { storeToRefs } from 'pinia'
import FdIcon from '../components/FdIcon.vue'
import FdConfirmDialog from '../components/FdConfirmDialog.vue'
import { sgd } from '../services/format.js'
import FdTabs from '../components/FdTabs.vue'
import FdListSearch from '../components/FdListSearch.vue'
import FdScrollArea from '../components/FdScrollArea.vue'
import FdTotalBar from '../components/FdTotalBar.vue'
import FdPager from '../components/FdPager.vue'
import { useListPages } from '../services/listPages.js'

const adminStore = useAdminStore()
const { stats, users, loading, error } = storeToRefs(adminStore)
const { fetchStats, fetchUsers, updateRole } = adminStore

const auth = useAuthStore()

const days = ref(7)
const search = ref('')
// Folder tabs like the Friends page: everyone, admins, users
const ROLE_TABS = [
  { id: 'all', label: 'All Users' },
  { id: 'admin', label: 'Admins' },
  { id: 'user', label: 'Users' }
]
const roleFilter = ref('all')

// The tab card (for the pager to scroll back to) and the scrolling list inside it
const tabsCard = ref(null)
const scrollArea = ref(null)

// Day hovered or tapped on each chart; null means today (the last day)
const searchPick = ref(null)
const activityPick = ref(null)

// Role change waiting for confirmation: { user, newRole }
const pending = ref(null)
const saving = ref(false)
const roleError = ref('')
const roleSuccess = ref('')

onMounted(async () => {
  await Promise.all([fetchStats(days.value), fetchUsers()])
})

async function setRange(n) {
  if (days.value === n) return
  days.value = n
  searchPick.value = null
  activityPick.value = null
  await fetchStats(n)
}

// Percent change from the period before; null when there is nothing to compare with
function change(m) {
  if (!m.previous) return m.current ? null : 0
  return Math.round(((m.current - m.previous) / m.previous) * 100)
}

const kpis = computed(function () {
  if (!stats.value) return []
  const k = stats.value.kpis
  return [
    { label: 'New Sign-ups', value: k.signups.current, delta: change(k.signups) },
    { label: 'Active Shoppers', value: k.active.current, delta: change(k.active) },
    { label: 'Searches', value: k.searches.current, delta: change(k.searches) },
    { label: 'Items Saved', value: k.saves.current, delta: change(k.saves) },
    { label: 'Save Rate', value: k.saveRate.current + '%', delta: change(k.saveRate) },
    { label: 'Price Drop Alerts', value: k.drops.current, delta: change(k.drops) },
    { label: 'Target Prices Hit', value: k.targets.current, delta: change(k.targets) },
    {
      label: 'Shoppers Could Save',
      value: sgd(stats.value.savings.total),
      note: 'On ' + stats.value.savings.items + ' wishlist items cheaper now'
    }
  ]
})

const compareText = computed(function () {
  return 'Compared to previous ' + days.value + ' days'
})

function deltaClass(d) {
  if (d === null || d === 0) return 'is-flat'
  return d > 0 ? 'is-up' : 'is-down'
}

function deltaText(d) {
  if (d === null) return 'New'
  return (d > 0 ? '+' : '') + d + '%'
}

// "2026-10-30" as "30 Oct"
function shortDay(day) {
  return new Date(day + 'T00:00:00+08:00').toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', timeZone: 'Asia/Singapore'
  })
}

const daily = computed(function () { return stats.value ? stats.value.daily : [] })

const rangeText = computed(function () {
  if (!daily.value.length) return ''
  return shortDay(daily.value[0].day) + ' to ' + shortDay(daily.value[daily.value.length - 1].day)
})

// Every day on 7 days, every 5th on 30 days, always the last one
function showLabel(i) {
  const last = daily.value.length - 1
  if (days.value === 7) return true
  return i === last || (last - i) % 5 === 0
}

// Round the top of a chart up to a tidy number
function niceMax(n) {
  if (n <= 4) return 4
  const step = Math.pow(10, Math.floor(Math.log10(n)))
  return Math.ceil(n / step) * step
}

const searchMax = computed(function () {
  return niceMax(Math.max(0, ...daily.value.map(function (d) { return d.searches })))
})

const searchIndex = computed(function () {
  return searchPick.value === null ? daily.value.length - 1 : searchPick.value
})

const searchDay = computed(function () { return daily.value[searchIndex.value] })

const searchVsBefore = computed(function () {
  const i = searchIndex.value
  if (i < 1) return null
  return change({ current: daily.value[i].searches, previous: daily.value[i - 1].searches })
})

const activityMax = computed(function () {
  return niceMax(Math.max(0, ...daily.value.map(function (d) { return Math.max(d.saves, d.alerts) })))
})

const activityIndex = computed(function () {
  return activityPick.value === null ? daily.value.length - 1 : activityPick.value
})

const activityDay = computed(function () { return daily.value[activityIndex.value] })

// x from 0 to 100, y from 0 (top) to 100 (bottom)
function xAt(i) {
  const n = daily.value.length
  return n < 2 ? 50 : (i / (n - 1)) * 100
}

function yAt(v) {
  return 100 - (v / activityMax.value) * 100
}

function linePoints(field) {
  return daily.value.map(function (d, i) { return xAt(i) + ',' + yAt(d[field]) }).join(' ')
}

const products = computed(function () { return stats.value ? stats.value.products : [] })

// Podium order left to right is 2, 1, 3, like a real podium
const podium = computed(function () {
  const order = [2, 1, 3]
  return products.value.slice(0, 3).map(function (p, i) {
    return { p, rank: i + 1, order: order.indexOf(i + 1) }
  })
})

// The price comparison for a product, like a search for it
function compareLink(p) {
  return { path: '/compare', query: { q: p.name } }
}

// Sort like the Wishlist's Sort by. Names sort by username, or email when there is none.
const USER_SORTS = [
  { value: 'az', label: 'Name (A to Z)' },
  { value: 'za', label: 'Name (Z to A)' },
  { value: 'saved', label: 'Most items saved' },
  { value: 'least', label: 'Fewest items saved' },
  { value: 'newest', label: 'Newest joined' },
  { value: 'earliest', label: 'Earliest joined' }
]
const userSort = ref('az')

function sortName(u) {
  return (u.username || u.email || '').toLowerCase()
}

// Everyone in the open role tab, before the search. While it is empty the search and sort hide.
const roleUsers = computed(function () {
  return users.value.filter(function (u) {
    return roleFilter.value === 'all' || u.role === roleFilter.value
  })
})

const filteredUsers = computed(function () {
  const q = search.value.trim().toLowerCase()
  const list = users.value.filter(function (u) {
    if (roleFilter.value !== 'all' && u.role !== roleFilter.value) return false
    if (!q) return true
    return (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
  })
  return list.sort(function (a, b) {
    if (userSort.value === 'saved' && a.wishlistCount !== b.wishlistCount) return b.wishlistCount - a.wishlistCount
    if (userSort.value === 'least' && a.wishlistCount !== b.wishlistCount) return a.wishlistCount - b.wishlistCount
    if (userSort.value === 'newest' || userSort.value === 'earliest') {
      const byDate = new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      if (byDate) return userSort.value === 'newest' ? -byDate : byDate
    }
    const byName = sortName(a).localeCompare(sortName(b))
    return userSort.value === 'za' ? -byName : byName
  })
})

// A new tab starts at the top of its list.
watch(roleFilter, function () {
  scrollArea.value?.toTop()
})

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(u) {
  const name = u.username || u.email || '?'
  return name.slice(0, 2).toUpperCase()
}

function askRoleChange(u, newRole) {
  roleError.value = ''
  roleSuccess.value = ''
  pending.value = { user: u, newRole }
}

function closeConfirm() {
  if (saving.value) return
  pending.value = null
}

async function confirmRoleChange() {
  const { user, newRole } = pending.value
  saving.value = true
  roleError.value = ''
  try {
    await updateRole(user.firebaseUid, newRole)
    roleSuccess.value = (user.username || user.email) + ' is now ' + (newRole === 'admin' ? 'an admin.' : 'a user.')
    pending.value = null
  } catch (err) {
    roleError.value = err.response?.data?.error || 'Could not update role.'
  } finally {
    saving.value = false
  }
}

// Phones: 10 rows a page, with the page buttons in the bar. Wider: the count only.
const { page: listPage, pageCount: listPageCount, pageRows, rowCount: listTotal, isPhone: listOnPhone } = useListPages(
  filteredUsers,
  [roleFilter, search, userSort]
)
</script>

<template>
  <div>
    <h1 class="fd-page-title">Admin Dashboard</h1>
    <p class="fd-page-subtitle">How shoppers are using FastDeal, and the deals it finds for them.</p>

    <!-- Shopper Insights: the leaderboard, stat cards, and charts, with the date range beside its title -->
    <div class="fd-admin-header">
      <h2 class="fd-section-title mb-0">Shopper Insights</h2>
      <div class="fd-range" role="group" aria-label="Date range">
        <button v-for="n in [7, 30]" :key="n" type="button" class="fd-range-btn" :class="{ 'is-active': days === n }"
          :aria-pressed="days === n" @click="setRange(n)">Last {{ n }} days</button>
      </div>
    </div>

    <div v-if="loading && !stats" class="text-secondary">Loading…</div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <template v-if="stats">
      <!-- Leaderboard first, in one card: the top 3 on a blue podium (2, 1, 3), 4 and 5 beside it.
           Each one opens its price comparison. -->
      <div class="card fd-board mb-3" :class="{ 'has-side': products.length > 3 }">
        <div class="fd-board-main">
          <p class="fd-board-title">Most saved products</p>
          <p v-if="!products.length" class="fd-board-empty">No products saved in this period.</p>
          <ol class="fd-stage list-unstyled" aria-label="Top 3 most saved products">
            <li v-for="slot in podium" :key="slot.p.key" class="fd-stage-slot" :class="'is-' + slot.rank"
              :style="{ order: slot.order }">
              <router-link class="fd-stage-link" :to="compareLink(slot.p)">
                <span class="fd-stage-image">
                  <img v-if="slot.p.image" :src="slot.p.image" alt="" />
                </span>
                <span class="fd-stage-name">{{ slot.p.name }}</span>
                <span class="fd-stage-pill">{{ slot.p.savers }} saved</span>
                <span class="fd-stage-block">
                  <span class="visually-hidden">Rank</span>{{ slot.rank }}
                </span>
              </router-link>
            </li>
          </ol>
        </div>

        <div v-if="products.length > 3" class="fd-board-side">
          <p class="fd-board-title fd-board-side-title">Also often saved</p>
          <ol class="fd-board-list list-unstyled" aria-label="Also often saved">
            <li v-for="(p, i) in products.slice(3)" :key="p.key">
              <router-link class="fd-board-row" :to="compareLink(p)">
                <span class="fd-board-rank">{{ String(i + 4).padStart(2, '0') }}</span>
                <span class="fd-board-image">
                  <img v-if="p.image" :src="p.image" alt="" />
                </span>
                <span class="fd-board-info">
                  <span class="fd-board-name">{{ p.name }}</span>
                  <span class="small text-secondary">{{ p.savers }} saved</span>
                </span>
              </router-link>
            </li>
          </ol>
        </div>
      </div>

      <!-- KPI cards -->
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3" v-for="k in kpis" :key="k.label">
          <div class="card h-100 fd-kpi">
            <div class="fd-kpi-top">
              <p class="small text-secondary mb-0">{{ k.label }}</p>
              <span v-if="!k.note" class="fd-delta" :class="deltaClass(k.delta)">{{ deltaText(k.delta) }}</span>
            </div>
            <p class="fd-kpi-value">
              {{ k.value }}
              <span v-if="!k.note && k.delta" class="fd-kpi-arrow" :class="deltaClass(k.delta)">
                <FdIcon :name="k.delta > 0 ? 'trending-up' : 'trending-down'" />
              </span>
            </p>
            <p class="small text-secondary mb-0">{{ k.note || compareText }}</p>
          </div>
        </div>
      </div>

      <!-- Charts -->
      <div class="row g-3 mb-5">
        <div class="col-12 col-lg-6">
          <div class="card h-100 fd-chart-card">
            <div class="fd-chart-head">
              <div>
                <p class="small text-secondary mb-1">Searches</p>
                <p class="small mb-0">{{ rangeText }}</p>
              </div>
              <div class="text-end">
                <p class="small text-secondary mb-1">{{ searchPick === null ? 'Today' : shortDay(searchDay.day) }}</p>
                <p class="fd-kpi-value mb-0">
                  {{ searchDay.searches }}
                  <span v-if="searchVsBefore !== null" class="fd-delta" :class="deltaClass(searchVsBefore)">
                    {{ deltaText(searchVsBefore) }}
                  </span>
                </p>
              </div>
            </div>

            <div class="fd-chart">
              <div class="fd-chart-grid" aria-hidden="true">
                <span>{{ searchMax }}</span>
                <span>{{ searchMax / 2 }}</span>
                <span>0</span>
              </div>
              <div class="fd-bars" @mouseleave="searchPick = null">
                <button v-for="(d, i) in daily" :key="d.day" type="button" class="fd-bar"
                  :class="{ 'is-picked': i === searchIndex }"
                  :aria-label="shortDay(d.day) + ': ' + d.searches + ' searches'" @mouseenter="searchPick = i" @focus="searchPick = i" @click="searchPick = i">
                  <span class="fd-bar-fill" :style="{ height: (d.searches / searchMax * 100) + '%' }"></span>
                </button>
              </div>
            </div>
            <div class="fd-chart-x" aria-hidden="true">
              <span v-for="(d, i) in daily" :key="d.day" :class="{ 'is-picked': i === searchIndex }">
                {{ showLabel(i) ? shortDay(d.day) : '' }}
              </span>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-6">
          <div class="card h-100 fd-chart-card">
            <div class="fd-chart-head">
              <div>
                <p class="small text-secondary mb-1">Saves and Alerts</p>
                <p class="small mb-0">{{ rangeText }}</p>
              </div>
              <div class="fd-chart-totals">
                <div>
                  <p class="small text-secondary mb-1"><span class="fd-key is-saves"></span>Saves</p>
                  <p class="fd-kpi-value mb-0">{{ activityDay.saves }}</p>
                </div>
                <div>
                  <p class="small text-secondary mb-1"><span class="fd-key is-alerts"></span>Alerts</p>
                  <p class="fd-kpi-value mb-0">{{ activityDay.alerts }}</p>
                </div>
              </div>
            </div>

            <div class="fd-chart">
              <div class="fd-chart-grid" aria-hidden="true">
                <span>{{ activityMax }}</span>
                <span>{{ activityMax / 2 }}</span>
                <span>0</span>
              </div>
              <div class="fd-lines">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polyline class="fd-line is-alerts" :points="linePoints('alerts')" />
                  <polyline class="fd-line is-saves" :points="linePoints('saves')" />
                </svg>
                <span class="fd-dot is-alerts"
                  :style="{ left: xAt(activityIndex) + '%', top: yAt(activityDay.alerts) + '%' }"></span>
                <span class="fd-dot is-saves"
                  :style="{ left: xAt(activityIndex) + '%', top: yAt(activityDay.saves) + '%' }"></span>
                <div class="fd-line-hits" @mouseleave="activityPick = null">
                  <button v-for="(d, i) in daily" :key="d.day" type="button"
                    :aria-label="shortDay(d.day) + ': ' + d.saves + ' saves, ' + d.alerts + ' alerts'"
                    @mouseenter="activityPick = i" @focus="activityPick = i" @click="activityPick = i"></button>
                </div>
              </div>
            </div>
            <div class="fd-chart-x" aria-hidden="true">
              <span v-for="(d, i) in daily" :key="d.day" :class="{ 'is-picked': i === activityIndex }">
                {{ showLabel(i) ? shortDay(d.day) : '' }}
              </span>
            </div>
          </div>
        </div>
      </div>

    </template>

    <!-- Manage users: folder tabs and cards, like the Friends page. Its own box, so the total
         bar sticks to the bottom of the screen only while this section is showing. -->
    <section class="fd-manage">
    <h2 class="fd-section-title">Manage Users</h2>

    <FdTabs ref="tabsCard" v-model="roleFilter" :tabs="ROLE_TABS" label="Users by role" id-prefix="fd-role-tab">
      <!-- Search and sort only once the open tab has someone to search, like the Wishlist. -->
      <div v-if="roleUsers.length" class="fd-list-tools">
        <FdListSearch v-model="search" placeholder="Search name or email" label="Search users by username or email" />
        <div class="fd-sort">
          <label for="admin-sort">Sort by</label>
          <select id="admin-sort" v-model="userSort" class="form-select">
            <option v-for="opt in USER_SORTS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>

      <div v-if="roleSuccess" class="alert alert-success" role="status">{{ roleSuccess }}</div>

      <FdScrollArea ref="scrollArea" class="fd-user-scroll" label="Users list" :bar="roleUsers.length > 0">
        <div v-if="filteredUsers.length" class="fd-user-rows">
          <div v-for="u in pageRows" :key="u.firebaseUid" class="fd-user-card">
            <div class="fd-avatar" aria-hidden="true">{{ initials(u) }}</div>
            <div class="fd-user-info">
              <div class="fd-user-name">
                {{ u.username || '(no username)' }}
                <span v-if="u.role === 'admin'" class="fd-role-tag">Admin</span>
              </div>
              <div class="fd-user-email">{{ u.email }}</div>
            </div>
            <div class="fd-user-meta">
              <span><strong>{{ u.wishlistCount }}</strong> saved</span>
              <span>Joined {{ formatDate(u.createdAt) }}</span>
            </div>
            <div class="fd-user-action">
              <span v-if="u.firebaseUid === auth.user?.uid" class="small text-secondary">You</span>
              <button v-else-if="u.role !== 'admin'" class="btn btn-sm btn-dark" type="button"
                @click="askRoleChange(u, 'admin')">Promote</button>
              <button v-else class="btn btn-sm btn-outline-dark" type="button"
                @click="askRoleChange(u, 'user')">Demote</button>
            </div>
          </div>
        </div>

        <p v-else-if="roleUsers.length" class="alert alert-secondary mb-0">No users match your search.</p>
        <p v-else class="alert alert-secondary mb-0">No {{ roleFilter === 'admin' ? 'admins' : 'users' }} here yet.</p>
      </FdScrollArea>
    </FdTabs>

    <FdTotalBar v-if="listTotal > 0" :stacked="listOnPhone">
      <FdPager v-model="listPage" :page-count="listPageCount" :total="listTotal" :buttons="listOnPhone" :noun="roleFilter === 'admin' ? 'admins' : 'users'" label="Users" :top="tabsCard?.panel" />
    </FdTotalBar>
    </section>
  </div>

  <!-- Confirm role change pop-up -->
  <FdConfirmDialog
    v-if="pending"
    :title="pending.newRole === 'admin' ? 'Promote user' : 'Demote user'"
    :confirm-label="pending.newRole === 'admin' ? 'Promote' : 'Demote'"
    :danger="pending.newRole !== 'admin'"
    :busy="saving"
    :error="roleError"
    @confirm="confirmRoleChange"
    @cancel="closeConfirm"
  >
    <template v-if="pending.newRole === 'admin'">
      Make <strong>{{ pending.user.username || pending.user.email }}</strong> an admin? They'll be able to see this
      dashboard and change other users' roles.
    </template>
    <template v-else>
      Remove admin access from <strong>{{ pending.user.username || pending.user.email }}</strong>?
    </template>
  </FdConfirmDialog>
</template>

<style scoped>
/* ===================================
   HEADER AND DATE RANGE
=================================== */

.fd-admin-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 2rem 0 1rem;
}

.fd-range {
  display: flex;
  gap: 0.5rem;
}

.fd-range-btn {
  min-height: var(--fd-control);
  padding: 0 1.25rem;
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: 999px;
  background: var(--fd-paper);
  color: var(--fd-text);
  font-size: var(--fd-button);
  font-weight: 700;
}

.fd-range-btn.is-active {
  border-color: var(--fd-blue);
  background: var(--fd-blue);
  color: var(--fd-beige);
}

/* ===================================
   KPI CARDS
=================================== */

.fd-kpi {
  padding: 1rem 1.25rem;
}

.fd-kpi-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.fd-kpi-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0 0.75rem;
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  font-size: var(--fd-section-title);
  line-height: 1.1;
}

.fd-chart-head .fd-kpi-value {
  justify-content: flex-end;
}

.fd-kpi-arrow {
  display: inline-flex;
}

.fd-kpi-arrow .fd-icon {
  width: 1.25rem;
  height: 1.25rem;
}

/* Change chip in the brand colours, pill shaped like the Wishlist price-drop tag:
   green up, red down, vanilla when flat or new */
.fd-delta {
  flex-shrink: 0;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  color: var(--fd-ink);
  font-family: var(--fd-font-body);
  font-size: var(--fd-small);
  font-weight: 700;
  line-height: 1.4;
}

.fd-delta.is-up {
  background: var(--fd-green);
}

.fd-delta.is-down {
  background: var(--fd-red);
}

.fd-delta.is-flat {
  background: var(--fd-vanilla-soft);
}

/* ===================================
   CHARTS
=================================== */

.fd-chart-card {
  padding: var(--fd-card-pad);
}

.fd-chart-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.fd-chart-totals {
  display: flex;
  gap: 1.5rem;
  text-align: right;
}

.fd-chart {
  position: relative;
  height: 12rem;
  padding-left: 2.5rem;
}

/* Three gridlines with their values on the left */
.fd-chart-grid {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.fd-chart-grid span {
  height: 0;
  border-top: 1px dashed var(--fd-grey-line);
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
  line-height: 0;
}

.fd-chart-grid span:last-child {
  border-top-style: solid;
}

.fd-bars {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 4%;
  height: 100%;
}

.fd-bar {
  display: flex;
  flex: 1;
  align-items: flex-end;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
}

.fd-bar-fill {
  width: 100%;
  min-height: 2px;
  border-radius: 0.375rem 0.375rem 0 0;
  background: var(--fd-grey-line);
}

.fd-bar.is-picked .fd-bar-fill {
  background: var(--fd-blue);
}

.fd-lines {
  position: relative;
  height: 100%;
}

.fd-lines svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.fd-line {
  fill: none;
  stroke-width: 3;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.fd-line.is-saves {
  stroke: var(--fd-blue);
}

.fd-line.is-alerts {
  stroke: var(--fd-text-muted);
  stroke-dasharray: 6 4;
}

.fd-dot {
  position: absolute;
  width: 0.875rem;
  height: 0.875rem;
  border: 3px solid var(--fd-paper);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.fd-dot.is-saves {
  background: var(--fd-blue);
}

.fd-dot.is-alerts {
  background: var(--fd-text-muted);
}

/* Invisible tap columns, one per day */
.fd-line-hits {
  position: absolute;
  inset: 0;
  display: flex;
}

.fd-line-hits button {
  flex: 1;
  padding: 0;
  border: 0;
  background: transparent;
}

.fd-key {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  margin-right: 0.375rem;
  border-radius: 50%;
}

.fd-key.is-saves {
  background: var(--fd-blue);
}

.fd-key.is-alerts {
  background: var(--fd-text-muted);
}

.fd-chart-x {
  display: flex;
  gap: 4%;
  margin-top: 0.5rem;
  padding-left: 2.5rem;
}

.fd-chart-x span {
  flex: 1;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
  text-align: center;
  white-space: nowrap;
}

.fd-chart-x span.is-picked {
  color: var(--fd-blue);
  font-weight: 700;
}
/* The count at the end of a row: the number in bold blue, its unit small beside it */
/* ===================================
   LEADERBOARD
=================================== */

.fd-board {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
  padding: 0;
  border-color: var(--fd-blue);
  background: var(--fd-blue);
}

/* With 4 and 5: podium three quarters, list one quarter */
@media (min-width: 992px) {
  .fd-board.has-side {
    grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
  }
}

/* The podium half is blue; the blocks stand on its bottom edge */
.fd-board-main {
  display: flex;
  flex-direction: column;
  background: var(--fd-blue);
}

.fd-board-title {
  margin: 0;
  padding: 1rem 1.25rem 0;
  color: var(--fd-beige);
  font-size: var(--fd-small);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.fd-board-empty {
  margin: 0;
  padding: 1rem 1.25rem 1.25rem;
  color: var(--fd-beige);
}

.fd-stage {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.75rem;
  margin: auto 0 0;
  padding: 0.5rem 1.25rem 0;
}

.fd-stage-slot {
  flex: 1;
  max-width: 13rem;
  min-width: 0;
}

.fd-stage-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--fd-beige);
  text-align: center;
  text-decoration: none;
}

.fd-stage-image {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  overflow: hidden;
  border: 3px solid var(--fd-beige);
  border-radius: 50%;
  background: var(--fd-white);
}

.fd-stage-slot.is-1 .fd-stage-image {
  width: 4.25rem;
  height: 4.25rem;
  border-color: var(--fd-vanilla);
}

.fd-stage-image img {
  width: 100%;
  height: 100%;
  padding: 0.3rem;
  object-fit: contain;
}

/* One line, so the podium stays thin */
.fd-stage-name {
  max-width: 100%;
  margin-top: 0.375rem;
  overflow: hidden;
  font-size: var(--fd-small);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fd-stage-pill {
  margin: 0.25rem 0 0.5rem;
  padding: 0.0625rem 0.5rem;
  border-radius: 999px;
  background: var(--fd-vanilla);
  color: var(--fd-ink);
  font-size: var(--fd-small);
  font-weight: 700;
}

/* The podium blocks: 1 tallest, then 2, then 3, with the rank in Anton */
.fd-stage-block {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  padding-top: 0.5rem;
  border-radius: 0.75rem 0.75rem 0 0;
  background: rgb(244 237 227 / 18%);
  color: var(--fd-beige);
  font-family: var(--fd-font-display);
  font-size: var(--fd-section-title);
  line-height: 1;
  transition: background-color 0.15s ease;
}

.fd-stage-slot.is-1 .fd-stage-block {
  height: 5.5rem;
  background: rgb(244 237 227 / 28%);
}

.fd-stage-slot.is-2 .fd-stage-block {
  height: 4rem;
}

.fd-stage-slot.is-3 .fd-stage-block {
  height: 3rem;
}

/* Hover: the block brightens. Nothing moves or grows. */
.fd-stage-link:hover .fd-stage-block,
.fd-stage-link:focus-visible .fd-stage-block {
  background: rgb(244 237 227 / 38%);
}

.fd-stage-link:focus-visible {
  outline: 3px solid var(--fd-vanilla);
  outline-offset: 2px;
}

/* 4 and 5 beside the podium: paper cards floating on the blue */
.fd-board-side {
  display: flex;
  flex-direction: column;
  padding: 0 1.25rem 1.25rem;
}

.fd-board-side-title {
  padding: 1rem 0 0.75rem;
}

.fd-board-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 0.75rem;
  margin: 0;
}

.fd-board-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--fd-radius);
  background: var(--fd-paper);
  box-shadow: 0 0.5rem 1.25rem rgb(0 0 0 / 18%);
  color: var(--fd-text);
  text-decoration: none;
  transition: box-shadow 0.15s ease;
}

/* Hover highlights the row with a blue outline, keeping its shadow. It never moves. */
.fd-board-row:hover,
.fd-board-row:focus-visible {
  box-shadow: 0 0 0 var(--fd-border) var(--fd-blue), 0 0.5rem 1.25rem rgb(0 0 0 / 18%);
}

.fd-board-row:focus-visible {
  outline: 3px solid var(--fd-vanilla);
  outline-offset: 2px;
}

.fd-board-rank {
  flex-shrink: 0;
  width: 1.75rem;
  color: var(--fd-text-muted);
  font-weight: 700;
}

.fd-board-image {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  overflow: hidden;
  border: 1px solid var(--fd-vanilla-line);
  border-radius: 50%;
  background: var(--fd-white);
}

.fd-board-image img {
  width: 100%;
  height: 100%;
  padding: 0.25rem;
  object-fit: contain;
}

.fd-board-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.fd-board-name {
  overflow: hidden;
  color: var(--fd-blue);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .fd-stage-image,
  .fd-stage-block,
  .fd-board-row {
    transition: none;
  }

  .fd-stage-link:hover .fd-stage-image,
  .fd-stage-link:focus-visible .fd-stage-image,
  .fd-board-row:hover,
  .fd-board-row:focus-visible {
    transform: none;
  }
}

@media (max-width: 576px) {
  .fd-stage {
    gap: 0.5rem;
    padding: 0.5rem 0.75rem 0;
  }

  .fd-stage-image {
    width: 3rem;
    height: 3rem;
  }

  .fd-stage-slot.is-1 .fd-stage-image {
    width: 3.5rem;
    height: 3.5rem;
  }
}

/* ===================================
   MANAGE USERS (same as Friends)
=================================== */

/* Folder tabs, search, sort, and the total bar are the shared ones (FdTabs and friends, styles in
   app.css). Unlike the other tab lists, this one has a set height: short lists leave white space
   under them, longer ones scroll inside, and the page scrolls around the card. */
.fd-tabs-panel .fd-user-scroll {
  flex: 0 0 auto;
  height: var(--fd-list-max);
}

/* Phones: no box inside the card. The list runs its full length and the page scrolls instead. */
@media (max-width: 767.98px) {
  .fd-tabs-panel .fd-user-scroll {
    height: auto;
  }
}

.fd-user-rows {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fd-user-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: var(--fd-radius);
  background: var(--fd-paper);
}

.fd-avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--fd-blue);
  color: var(--fd-beige);
  font-family: var(--fd-font-body);
  font-size: var(--fd-body);
  font-weight: 700;
}

.fd-user-info {
  flex: 1;
  min-width: 0;
}

.fd-user-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--fd-blue);
  font-size: var(--fd-section-subtitle);
  font-weight: 700;
}

.fd-user-email {
  overflow: hidden;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fd-user-meta {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 1.25rem;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
}

/* Admin tag: the same size as the Wishlist price-drop tag, in vanilla. Users get no tag. */
.fd-role-tag {
  display: inline-block;
  padding: 0.0625rem 0.5rem;
  border-radius: 999px;
  background: var(--fd-vanilla);
  color: var(--fd-ink);
  font-size: var(--fd-small);
  font-weight: 700;
  line-height: 1.4;
}

.fd-user-action {
  flex-shrink: 0;
  min-width: 6rem;
  text-align: right;
}

@media (max-width: 767.98px) {
  .fd-user-card {
    flex-wrap: wrap;
  }

  .fd-user-meta {
    order: 3;
    width: 100%;
    padding-left: calc(44px + 0.875rem);
  }
}
</style>
