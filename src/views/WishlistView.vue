<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { sgd, storeLink } from '../services/format.js'
import FdIcon from '../components/FdIcon.vue'
import FdLoadingDots from '../components/FdLoadingDots.vue'
import FdTelegramPrompt from '../components/FdTelegramPrompt.vue'
import FdConfirmDialog from '../components/FdConfirmDialog.vue'
import FdScrollArea from '../components/FdScrollArea.vue'
import axios from 'axios'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../store/auth.js'
import { useWishlistStore } from '../store/wishlist.js'
import FdTabs from '../components/FdTabs.vue'
import FdListSearch from '../components/FdListSearch.vue'
import FdEmptyState from '../components/FdEmptyState.vue'

const router = useRouter()
const route = useRoute()

// All wishlist data and logic live in the wishlist store. This view keeps only the page layout,
// the search and sort, and the pop-up handling (focus, openers, the sleep time picker).
const { user } = storeToRefs(useAuthStore())
const wishlistStore = useWishlistStore()
const {
  now, liveLoading, liveErrors,
  verdictItem, verdictLoading, verdictError, activeVerdict,
  budget, included, plan, planIndex, budgetError, plannable, heldCount, option, pickedItems, missedItems,
  drafts, editing, editingDraft, draftName, draftSaving, draftError, draftChanged,
  buyItem, selected, inviting, inviteSent, error: buyError
} = storeToRefs(wishlistStore)
const {
  removeSaved, setTarget, sleepOn,
  best, loadLivePrice, saving, cheaper, savingPercent, reached, asleep,
  hasFinishedSleep, openVerdict: loadVerdict, closeVerdict,
  clearPlan, findPlan, nextOption, rankOf, setRank, cheapestPlannable, startDraft, closeDraft, saveDraft, removeDraft,
  fetchFriendOverlap, friendsFor, allInvited, openBuyTogether, closeBuyTogether, sendInvites
} = wishlistStore

if (!user.value) {
  router.replace('/login?next=/wishlist')
}

// Products saved from a product page open it again. Older items open a search for the name.
function productLink(item) {
  if (item.productId) {
    return { path: '/product/' + item.productId, query: { q: item.q || item.name } }
  }
  return { path: '/compare', query: { q: item.name } }
}

// Remove pop-up for a saved product ({ kind: 'item', name }) or a saved budget ({ kind: 'budget', id, name }).
const confirmRemove = ref(null)
const confirmBusy = ref(false)

async function onConfirmRemove() {
  const target = confirmRemove.value
  if (target.kind === 'item') {
    removeSaved(target.name)
    confirmRemove.value = null
    return
  }
  confirmBusy.value = true
  draftError.value = ''
  await removeDraft(target.id)
  confirmBusy.value = false
  if (!draftError.value) confirmRemove.value = null
}

// Ticks every 30 seconds so the "left" countdown on held items stays current.
let clock = 0

onMounted(function () {
  clock = window.setInterval(function () {
    now.value = Date.now()
  }, 30000)
})

onBeforeUnmount(function () {
  window.clearInterval(clock)
})

watch(
  () => user.value?.wishlist?.map(item => item.name).join('|') ?? '',
  async () => {
    if (!user.value) return

    for (const item of user.value.wishlist) {
      if (!best(item)) {
        await loadLivePrice(item.name)
      }
    }
  },
  { immediate: true }
)

watch(
  () => user.value?.wishlist?.map(item => item.productKey).join('|') ?? '',
  function () {
    if (user.value) fetchFriendOverlap()
  },
  { immediate: true }
)

function leftText(item) {
  const ms = item.sleepUntil - now.value
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.max(Math.floor((ms % 3600000) / 60000), 1)
  if (days > 0) {
    return days + 'd ' + hours + 'h left'
  }
  return hours > 0 ? hours + 'h ' + minutes + 'm left' : minutes + 'm left'
}

// When a hold ends, shown on the card under the countdown.
function untilText(item) {
  return new Date(item.sleepUntil).toLocaleString('en-SG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  })
}

// Folder tabs like the Friends and Notifications pages: everything, price drops, and items on hold.
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'drops', label: 'Price drops' },
  { id: 'sleeping', label: 'Sleep on it' },
  { id: 'budget', label: 'Plan a budget' }
]
const activeTab = ref('all')

// The tab card (for the pager to scroll back to) and the scrolling list inside it
const scrollArea = ref(null)

const tabFilters = {
  all: function () { return true },
  drops: function (item) { return !asleep(item) && cheaper(item) },
  sleeping: function (item) { return asleep(item) },
  budget: function () { return true }
}

watch(activeTab, function (tab) {
  if (tab === 'budget') openBudgetTab()
  scrollArea.value?.toTop()
})

// Shown when the open tab has nothing in it
const emptyText = computed(function () {
  if (query.value.trim()) return 'No saved products match "' + query.value.trim() + '".'
  if (activeTab.value === 'drops') return 'No price drops right now. FastDeal keeps checking.'
  if (activeTab.value === 'sleeping') return 'Nothing on hold. Press the moon on a product to sleep on it.'
  return 'No saved products yet. Search, then press Save.'
})

const emptyIcon = computed(function () {
  if (query.value.trim()) return 'search'
  if (activeTab.value === 'drops') return 'trending-down'
  if (activeTab.value === 'sleeping') return 'moon'
  return 'heart'
})

// Search box and sort menu above the table.
const query = ref('')
const sortBy = ref('latest')

// Worded like the sort menus on shopping sites: "Label: direction".
const sortOptions = [
  { value: 'latest', label: 'Date added: Latest' },
  { value: 'earliest', label: 'Date added: Earliest' },
  { value: 'cheap', label: 'Price: Low to High' },
  { value: 'pricey', label: 'Price: High to Low' },
  { value: 'az', label: 'Name: A to Z' },
  { value: 'za', label: 'Name: Z to A' }
]

// Price sorts use today's best price, not the saved price.
const sorters = {
  latest: function (a, b) { return b.savedAt - a.savedAt },
  earliest: function (a, b) { return a.savedAt - b.savedAt },
  cheap: function (a, b) {
    const aPrice = best(a)?.price
    const bPrice = best(b)?.price

    if (aPrice == null) return bPrice == null ? 0 : 1
    if (bPrice == null) return -1

    return aPrice - bPrice
  },

  pricey: function (a, b) {
    const aPrice = best(a)?.price
    const bPrice = best(b)?.price

    if (aPrice == null) return bPrice == null ? 0 : 1
    if (bPrice == null) return -1

    return bPrice - aPrice
  },
  az: function (a, b) { return a.name.localeCompare(b.name) },
  za: function (a, b) { return b.name.localeCompare(a.name) }
}

// Everything in the open tab before the search, so search and sort only show when there is
// something to search, like the budget list.
const tabItems = computed(function () {
  return user.value ? user.value.wishlist.filter(tabFilters[activeTab.value]) : []
})

const shownItems = computed(function () {
  if (!user.value) {
    return []
  }
  const words = query.value.trim().toLowerCase()
  return user.value.wishlist
    .filter(tabFilters[activeTab.value])
    .filter(function (item) { return item.name.toLowerCase().includes(words) })
    .sort(sorters[sortBy.value])
})

// Placeholder for products without a photo: the first letter of the first two words.
// Saved photos whose link no longer loads show the initials instead, like a product with no photo.
const brokenImages = ref({})

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(function (word) { return word.charAt(0) }).join('').toUpperCase()
}

// The faint hint in an empty target box, like "Your name" on a form: the AI's suggested target from
// the price history and the listings. Only a hint: no alert is set until the shopper types a price.
// With no suggestion the box is plain empty.
function targetHint(item) {
  return Number(item.targetSuggestion) > 0 ? Number(item.targetSuggestion).toFixed(2) : null
}

async function onTarget(item, event) {
  const nextTarget = Number(event.target.value)
  const previousTarget = Number(item.targetPrice)

  if (nextTarget === previousTarget) return

  try {
    await setTarget(item.name, event.target.value)

    const listing = best(item)

    if (
      item.productKey &&
      listing &&
      nextTarget > 0 &&
      listing.price <= nextTarget
    ) {
      await axios.post(
        '/api/wishlist/' +
        encodeURIComponent(item.productKey) +
        '/check-target'
      )
    }
  } catch (error) {
    console.warn(
      '[Target email] Could not save or check target:',
      error.response?.data?.error || error.message
    )
  }
}

// Sleep on it pop-up: pick how long to lock the item in days, hours, and minutes, 1 day by default.
// The picker keeps one total in minutes; each box shows its part of it.
const MAX_DAYS = 7
const MAX_MINUTES = MAX_DAYS * 1440
const units = [
  { key: 'days', label: 'Days', size: 1440, more: 'One more day', less: 'One less day' },
  { key: 'hours', label: 'Hours', size: 60, more: 'One more hour', less: 'One less hour' },
  { key: 'minutes', label: 'Minutes', size: 1, more: 'One more minute', less: 'One less minute' }
]
const sleepItem = ref(null)
const sleepError = ref('')
const holdTotal = ref(1440)
const sleepDialog = ref(null)
let sleepOpener = null

const holdParts = computed(function () {
  return {
    days: Math.floor(holdTotal.value / 1440),
    hours: Math.floor((holdTotal.value % 1440) / 60),
    minutes: holdTotal.value % 60
  }
})

const holdMs = computed(function () {
  return holdTotal.value * 60000
})

// When the hold would end: now plus the picked time, shown under the picker.
const holdEndText = computed(function () {
  return new Date(now.value + holdMs.value).toLocaleString('en-SG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
})

function setHold(total) {
  holdTotal.value = Math.min(Math.max(Math.round(total), 0), MAX_MINUTES)
}

// Arrows step one unit; extra hours roll into days and extra minutes into hours.
function stepHold(unit, direction) {
  setHold(holdTotal.value + direction * unit.size)
}

// Typing replaces that box's part. Typing 90 minutes is fine: it becomes 1 hour 30 minutes.
function onHoldInput(unit, event) {
  const typed = Math.max(Number(event.target.value) || 0, 0)
  const rest = holdTotal.value - holdParts.value[unit.key] * unit.size
  setHold(rest + typed * unit.size)
  event.target.value = shown(unit)
}

function shown(unit) {
  const n = holdParts.value[unit.key]
  return unit.key === 'days' ? String(n) : String(n).padStart(2, '0')
}

function openSleep(item, event) {
  sleepItem.value = item
  now.value = Date.now()
  holdTotal.value = 1440
  sleepOpener = event.currentTarget
  nextTick(() => sleepDialog.value?.querySelector('#hold-days')?.focus())
}

function closeSleep() {
  sleepItem.value = null
  nextTick(() => sleepOpener?.focus())
}

function confirmSleep() {
  if (!sleepItem.value || !holdMs.value) {
    return
  }

  const item = sleepItem.value
  const priceAtStart = Number(item.savedPrice)

  if (!Number.isFinite(priceAtStart) || priceAtStart <= 0) {
    sleepError.value = 'This product has no valid saved price.'
    return
  }

  sleepError.value = ''

  sleepOn(
    item.name,
    holdMs.value / 3600000,
    priceAtStart
  )

  closeSleep()
}

// Purchase verdict pop-up: the price lookup and maths are in the store; the view only moves focus.
const verdictDialog = ref(null)

function openVerdict(item) {
  nextTick(() => {
    verdictDialog.value?.querySelector('button')?.focus()
  })
  return loadVerdict(item)
}

watch(
  [() => route.query.verdict, () => user.value?.wishlist],
  ([productName]) => {
    if (typeof productName !== 'string' || !user.value) {
      return
    }

    const item = user.value.wishlist.find(
      saved => saved.name === productName
    )

    if (!item || !hasFinishedSleep(item)) {
      return
    }

    // Open the same popup used by View purchase verdict.
    openVerdict(item)

    // Remove the query parameter so refreshing the page
    // doesn't automatically reopen the same verdict.
    const { verdict, ...remainingQuery } = route.query

    router.replace({
      path: route.path,
      query: remainingQuery
    })
  },
  { immediate: true }
)

// Plan a budget tab: the drafts and the numbers are in the store. Opening the tab drops items
// that went on hold from the budget being edited.
function openBudgetTab() {
  plan.value = null
  budgetError.value = ''
  included.value = included.value.filter(function (name) {
    return plannable.value.some(function (item) { return item.name === name })
  })
}

// Search and sort for the budget list: by name, or by when it was saved. No price sort.
const budgetQuery = ref('')
const budgetSort = ref('latest')

const budgetSortOptions = [
  { value: 'latest', label: 'Date saved: Latest' },
  { value: 'earliest', label: 'Date saved: Earliest' },
  { value: 'az', label: 'Name: A to Z' },
  { value: 'za', label: 'Name: Z to A' }
]

const budgetSorters = {
  latest: function (a, b) { return new Date(b.savedAt) - new Date(a.savedAt) },
  earliest: function (a, b) { return new Date(a.savedAt) - new Date(b.savedAt) },
  az: function (a, b) { return a.name.localeCompare(b.name) },
  za: function (a, b) { return b.name.localeCompare(a.name) }
}

const shownDrafts = computed(function () {
  const words = budgetQuery.value.trim().toLowerCase()
  return drafts.value
    .filter(function (d) { return d.name.toLowerCase().includes(words) })
    .sort(budgetSorters[budgetSort.value])
})

function savedText(date) {
  return new Date(date).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

// The pop-up opens from a budget in the list or New budget, and gives focus back on close.
const nameInput = ref(null)
let budgetOpener = null

const budgetInput = ref(null)
const askingName = ref(false)

function openBudget(draft, event) {
  budgetOpener = event.currentTarget
  askingName.value = false
  startDraft(draft)
  nextTick(() => budgetInput.value?.focus())
}

function closeBudget() {
  askingName.value = false
  closeDraft()
  nextTick(() => budgetOpener?.focus())
}

// Save as draft: a saved budget updates under its name; a new one asks for a name first.
function onSaveDraft() {
  if (editingDraft.value) {
    saveDraft()
    return
  }
  askingName.value = true
  nextTick(() => nameInput.value?.focus())
}

async function confirmSaveDraft() {
  await saveDraft()
  if (!draftError.value) askingName.value = false
}

// A changed budget or item list clears the result, so the name prompt goes with it.
watch(plan, function (value) {
  if (!value) askingName.value = false
})

const draftStatus = computed(function () {
  if (!editingDraft.value) return 'Not saved yet'
  if (draftSaving.value) return 'Saving…'
  return 'Last updated ' + savedText(editingDraft.value.savedAt)
})

// Buy Together: friends who saved the same product. The pop-up state lives in the store.
const showTelegramPrompt = ref(false)

function onBuyTogether(item) {
  if (!user.value.telegramUsername) {
    showTelegramPrompt.value = true
    return
  }
  openBuyTogether(item)
}

// The whole list, scrolling inside its card, with the total under the card.
const listRows = computed(function () {
  return activeTab.value === 'budget' ? shownDrafts.value : shownItems.value
})
const listTotal = computed(function () { return listRows.value.length })
</script>

<template>
  <div v-if="user" class="fd-list-page">
    <h1 class="fd-page-title">Wishlist</h1>
    <p class="fd-page-subtitle">What you saved, next to the best price right now. If another store is cheaper, it shows as a
      price drop.<br />
      Not sure yet? Sleep on it. Got a budget?<br class="d-md-none" /> Plan one to see what fits best.</p>

    <!-- Always shown, even with nothing saved: like Notifications, the card stays open with an
         empty message inside, and Plan a budget is still there. -->
    <template v-if="user">
      <!-- The open tab and the card under it are one piece, like a folder tab. Search, the column
           header, and the product cards all sit inside it; the cards scroll inside the card. -->
      <FdTabs v-model="activeTab" :tabs="TABS" label="Wishlist" id-prefix="fd-wtab">
      <!-- Plan a budget: tick, rank, set a budget, and save it as a draft for later -->
      <FdScrollArea v-if="activeTab === 'budget'" ref="scrollArea" fill page label="Plan a budget" :bar="drafts.length > 0">
        <!-- Your budgets: every saved draft, newest first, and a button to start a new one -->
        <div>
          <!-- No budgets: the empty message with New budget centred under it -->
          <FdEmptyState v-if="!drafts.length" icon="wallet">
            No saved budgets yet.
            <template #action>
              <button class="btn btn-dark" type="button" @click="openBudget(null, $event)">New budget</button>
            </template>
          </FdEmptyState>

          <template v-else>
            <!-- Search and sort like the product tabs. New budget sits at the bottom right of the card. -->
            <div class="fd-list-tools fd-wish-tools fd-drafts-tools">
              <FdListSearch v-model="budgetQuery" placeholder="Search your budgets" label="Search your budgets" />
              <div class="fd-sort">
                <label for="budget-sort">Sort by</label>
                <select id="budget-sort" v-model="budgetSort" class="form-select">
                  <option v-for="opt in budgetSortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>

            <FdEmptyState v-if="!shownDrafts.length" icon="search">No budgets match "{{ budgetQuery.trim() }}".</FdEmptyState>
            <ul v-else class="fd-drafts list-unstyled mb-0">
            <li v-for="d in listRows" :key="d._id" class="fd-draft">
              <button class="fd-draft-open" type="button" @click="openBudget(d, $event)">
                <span class="fd-draft-name">{{ d.name }}</span>
                <span class="small text-secondary">
                  {{ d.amount !== null ? sgd(d.amount) : 'No budget set' }}
                  · {{ d.items.length }} {{ d.items.length === 1 ? 'item' : 'items' }}
                  · Saved {{ savedText(d.savedAt) }}
                </span>
              </button>
              <button class="btn btn-outline-danger btn-sm fd-icon-btn" type="button"
                :aria-label="'Delete ' + d.name" title="Delete" @click="confirmRemove = { kind: 'budget', id: d._id, name: d.name }">
                <FdIcon name="trash" />
              </button>
            </li>
            </ul>
          </template>
          <p v-if="draftError" class="small text-danger mt-2 mb-0">{{ draftError }}</p>
        </div>


        <!-- With saved budgets: New budget at the bottom right of the card, beside the full-height
             scrollbar. From md down it is a round plus button; the label stays for screen readers. -->
        <template v-if="drafts.length" #footer>
          <div class="fd-budget-add">
            <button class="btn btn-dark fd-budget-new" type="button" @click="openBudget(null, $event)">
              <FdIcon name="plus" />
              <span class="fd-budget-new-text">New budget</span>
            </button>
          </div>
        </template>
      </FdScrollArea>

      <template v-else>
      <div v-if="tabItems.length" class="fd-list-tools fd-wish-tools">
        <FdListSearch v-model="query" placeholder="Search your wishlist" label="Search your wishlist" />
        <div class="fd-sort">
          <label for="wish-sort">Sort by</label>
          <select id="wish-sort" v-model="sortBy" class="form-select">
            <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>

      <!-- A table built from rows of cards: the header is a pill above the scrolling list, each
           product is its own card. Roles keep it a table for screen readers. -->
      <div class="fd-wish-table" role="table" aria-label="Saved products">
        <div v-if="shownItems.length" class="fd-wish-headbar" role="rowgroup">
          <div class="fd-wish-head" role="row">
            <span role="columnheader">Product</span>
            <span role="columnheader">Saved price</span>
            <span role="columnheader">Best now</span>
            <span role="columnheader">Target price alert</span>
            <span role="columnheader"><span class="visually-hidden">Actions</span></span>
          </div>
        </div>

        <FdScrollArea ref="scrollArea" fill page label="Saved products" :bar="tabItems.length > 0">
        <!-- Nothing in this tab: the same icon-and-line empty state as Notifications -->
        <FdEmptyState v-if="!shownItems.length" :icon="emptyIcon">{{ emptyText }}</FdEmptyState>
        <div v-else class="fd-wish-rows" role="rowgroup">
          <div v-for="item in listRows" :key="item.name" class="fd-wish-row" :class="{ 'is-asleep': asleep(item) }"
            role="row">
            <div class="fd-wish-cell fd-wish-cell-product" role="cell">
              <!-- On hold the photo and name are plain text, not a link, so the product cannot be opened
                   (and bought) until the hold ends. -->
              <component :is="asleep(item) ? 'span' : 'router-link'" class="fd-wish-product"
                v-bind="asleep(item) ? { 'aria-disabled': 'true' } : { to: productLink(item) }">
                <span class="fd-wish-image">
                  <img v-img-loading v-if="item.image && !brokenImages[item.name]" :src="item.image"
                    alt="" @error="brokenImages[item.name] = true" />
                  <span v-else>{{ initials(item.name) }}</span>
                </span>
                <span class="fd-section-subtitle mb-0">{{ item.name }}</span>
              </component>
              <!-- After Sleep on it ends: the verdict link sits under the product name -->
              <button v-if="hasFinishedSleep(item)" class="fd-verdict-link" type="button"
                @click="openVerdict(item)">
                View purchase verdict
              </button>
            </div>
            <!-- On hold: the prices, target, and buttons give way to one countdown across those columns. -->
            <div v-if="asleep(item)" class="fd-wish-cell fd-wish-countdown" role="cell" aria-colspan="4">
              <FdIcon name="moon" />
              <div>
                <strong class="d-block">Sleeping on it, {{ leftText(item) }}</strong>
                <span class="small text-secondary">Back on {{ untilText(item) }}</span>
              </div>
            </div>

            <template v-else>
              <div class="fd-wish-cell" role="cell">
                <span class="fd-wish-label" aria-hidden="true">Saved price</span>
                <strong>{{ sgd(item.savedPrice) }}</strong>
                <a v-if="item.savedStore" class="fd-text-link d-block small" :href="storeLink(item.savedStore, item.name)"
                  target="_blank" rel="noopener">{{ item.savedStore }}</a>
                <span v-else class="d-block small text-secondary">Store not recorded</span>
              </div>

              <div class="fd-wish-cell" role="cell">
                <span class="fd-wish-label" aria-hidden="true">
                  Best now
                </span>

                <FdLoadingDots v-if="liveLoading[item.name] && !best(item)" size="inline" message="Checking price" />

                <template v-else-if="best(item)">
                  <strong>{{ sgd(best(item).price) }}</strong>

                  <span v-if="cheaper(item)" class="fd-drop" :title="'Potential saving: ' + sgd(saving(item))">
                    −{{ savingPercent(item) }}%
                  </span>

                  <a v-if="best(item).link" class="fd-text-link d-block small" :href="best(item).link" target="_blank"
                    rel="noopener noreferrer">
                    {{ best(item).store || 'View listing' }}
                  </a>

                  <span v-else class="d-block small text-secondary">
                    {{ best(item).store || 'Store unavailable' }}
                  </span>
                </template>

                <div v-else>
                  <span class="small text-secondary">
                    {{ liveErrors[item.name] || 'Price unavailable' }}
                  </span>

                  <button type="button" class="btn btn-link btn-sm d-block p-0" @click="loadLivePrice(item.name)">
                    Retry
                  </button>
                </div>
              </div>
              <div class="fd-wish-cell fd-wish-target-cell" role="cell">
                <span class="fd-wish-label" aria-hidden="true">Target price alert</span>
                <div class="fd-target-row">
                  <div class="input-group fd-target-input">
                    <span class="input-group-text">S$</span>
                    <input :id="'target-' + item.name" class="form-control" type="number" min="0" step="0.01"
                      :value="item.targetPrice || ''"
                      :placeholder="targetHint(item)" :aria-label="'Target price for ' + item.name"
                      @change="onTarget(item, $event)" />
                  </div>
                  <span v-if="reached(item)" class="fd-reached" role="img" aria-label="Target reached"
                    title="Target reached">
                    <FdIcon name="check" />
                  </span>
                </div>
                <!-- The box's hint is the AI's suggestion; the tag shows while the box is empty. -->
                <p v-if="!item.targetPrice && targetHint(item)" class="fd-target-ai" :title="item.targetReason || null">
                  <span class="fd-ai-tag">AI</span> suggested<span v-if="item.targetReason" class="visually-hidden">: {{ item.targetReason }}</span>
                </p>
              </div>
              <div class="fd-wish-cell fd-wish-action-cell" role="cell">
                <div class="fd-wish-action-group">

                  <!-- Friends, moon and trash buttons -->
                  <div class="fd-wish-actions">
                    <div v-if="friendsFor(item.productKey).length" class="fd-friends-wrap">
                      <button class="btn btn-outline-dark btn-sm fd-icon-btn" type="button"
                        :aria-label="friendsFor(item.productKey).length + ' friends saved ' + item.name + '. Buy together'"
                        title="Friends who saved this. Buy together" @click="onBuyTogether(item)">
                        <FdIcon name="friends" />
                      </button>
                      <!-- Shown above the button once any friend is invited, not only when all are -->
                      <span v-if="friendsFor(item.productKey).some(f => f.invited)" class="fd-sent">Sent!</span>
                    </div>

                    <button class="btn btn-outline-dark btn-sm fd-icon-btn" type="button"
                      :aria-label="'Sleep on ' + item.name" title="Sleep on it" @click="openSleep(item, $event)">
                      <FdIcon name="moon" />
                    </button>

                    <button class="btn btn-outline-danger btn-sm fd-icon-btn" type="button"
                      :aria-label="'Remove ' + item.name" @click="confirmRemove = { kind: 'item', name: item.name }">
                      <FdIcon name="trash" />
                    </button>
                  </div>


                </div>
              </div>
            </template>
          </div>
        </div>
        </FdScrollArea>
      </div>
      </template>
      </FdTabs>
    </template>


    <!-- Last in the page so it can stick to the bottom of the screen and stop above the footer. -->
    <p v-if="listTotal > 0" class="fd-list-total">
      Total: {{ listTotal }} {{ activeTab === 'budget' ? (listTotal === 1 ? 'budget' : 'budgets') : (listTotal === 1 ? 'product' : 'products') }}
    </p>
  </div>

  <!-- Plan a budget pop-up for one budget: its name, the budget, and the ranked items. Opened from
       the budget list in the Plan a budget tab. Uses the welcome prompt's dialog styles from app.css. -->
  <div v-if="editing" class="fd-entry-backdrop" @click.self="closeBudget" @keydown.esc="closeBudget">
    <section class="fd-entry-dialog fd-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="fd-budget-title">
      <h2 id="fd-budget-title" class="fd-page-title">{{ editingDraft ? editingDraft.name : 'Plan a budget' }}</h2>

      <form @submit.prevent="findPlan">
        <label class="fd-hold-legend d-block text-start" for="budget-amount">Your budget</label>
        <div class="input-group fd-budget-input mb-4">
          <span class="input-group-text">S$</span>
          <input id="budget-amount" ref="budgetInput" v-model="budget" class="form-control" type="number"
            inputmode="decimal" min="0" step="0.01" placeholder="1000" @input="clearPlan" />
        </div>

        <fieldset class="mb-4">
          <legend class="fd-hold-legend text-start mb-1">Items to include</legend>
          <p class="small text-secondary mb-2">Tick the items you want in the calculation, then rank them: 1 is the
            highest priority. If they cannot all fit, higher priorities go in first.</p>
          <ul class="fd-check-list">
            <li v-for="item in plannable" :key="item.name">
              <input :id="'include-' + item.name" v-model="included" class="form-check-input" type="checkbox"
                :value="item.name" @change="clearPlan" />
              <label class="fd-check-label" :for="'include-' + item.name">
                <span>{{ item.name }}</span>
              </label>
              <select v-if="rankOf(item.name)" class="form-select fd-rank" :value="rankOf(item.name)"
                :aria-label="'Priority for ' + item.name + ', 1 is highest'" @change="setRank(item.name, $event)">
                <option v-for="n in included.length" :key="n" :value="n">{{ n }}</option>
              </select>
            </li>
          </ul>
          <p v-if="heldCount" class="small text-secondary mt-2 mb-0">{{ heldCount }} {{ heldCount === 1 ? 'item is' :
            'items are' }} on hold and left out.</p>
        </fieldset>

        <p v-if="budgetError" class="alert alert-danger mb-3">{{ budgetError }}</p>

        <div class="fd-entry-actions">
          <button class="btn btn-dark fd-btn-lg" type="submit" :disabled="!plannable.length">Find best
            combination</button>
        </div>
      </form>

      <section v-if="plan" class="fd-budget-result" aria-live="polite">
        <template v-if="option">
          <p v-if="!plan.mustFits" class="alert alert-secondary mb-3">
            Your ticked items come to {{ sgd(plan.mustTotal) }}, which is over your budget, so not all of them fit.
            <template v-if="missedItems.length">This mix leaves out {{ missedItems.join(', ') }}.</template>
          </p>
          <p v-if="!plan.saved && planIndex === 0" class="mb-2"><span class="fd-best">Best combination</span></p>
          <ul class="fd-budget-pick">
            <li v-for="item in pickedItems" :key="item.name">
              <span>
                {{ item.name }}
                <span class="badge text-bg-dark ms-1">#{{ item.rank }}</span>
                <span class="d-block small text-secondary">at {{ item.store }}</span>
              </span>
              <strong>{{ sgd(item.price) }}</strong>
            </li>
          </ul>
          <p class="fd-budget-total">
            <span>Total <strong>{{ sgd(option.total) }}</strong></span>
            <span>{{ sgd(option.left) }} left of {{ sgd(Number(budget)) }}</span>
          </p>
          <!-- Always shown once there is a result. With only one mix there is nothing else to try. -->
          <button class="btn btn-dark fd-btn-lg w-100 mb-2" type="button"
            :disabled="!plan.saved && plan.options.length < 2"
            @click="nextOption">{{ !plan.saved && plan.options.length < 2 ? 'No other combination fits' : 'Try another combination' }}</button>
        </template>
        <p v-else class="alert alert-secondary mb-3">
          Nothing fits in {{ sgd(Number(budget)) }}.
          <template v-if="cheapestPlannable()">The cheapest item is {{ cheapestPlannable().name }} at {{
            sgd(best(cheapestPlannable()).price) }}.</template>
        </p>

      </section>

      <button class="btn btn-outline-dark fd-btn-lg w-100 mt-2" type="button" @click="closeBudget">Close</button>

      <!-- Save for later, under Close once there is a result. A new budget asks for its name first. -->
      <template v-if="plan">
      <form v-if="askingName" class="fd-draft-name-form" @submit.prevent="confirmSaveDraft">
        <label class="fd-hold-legend d-block text-start" for="budget-name">Give this budget a name</label>
        <div class="input-group">
          <input id="budget-name" ref="nameInput" v-model="draftName" class="form-control" type="text"
            maxlength="60" placeholder="e.g. Christmas gifts" autocomplete="off" />
          <button class="btn btn-dark" type="submit" :disabled="draftSaving">
            {{ draftSaving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
      <!-- A text link, like Forgot password? on the login page. A saved budget saves by itself, so
           it only shows when it was last updated. -->
      <p v-else class="fd-budget-actions small">
        <template v-if="!editingDraft">
          <span class="text-secondary">Want to come back to this?</span>
          <button class="btn btn-link p-0 fd-draft-link" type="button" :disabled="draftSaving" @click="onSaveDraft">
            {{ draftSaving ? 'Saving…' : 'Save it for later' }}
          </button>
        </template>
        <span v-else class="text-secondary" aria-live="polite">{{ draftStatus }}</span>
      </p>
      <p v-if="draftError" class="small text-danger mt-2 mb-0">{{ draftError }}</p>
      </template>
    </section>
  </div>

  <FdTelegramPrompt v-if="showTelegramPrompt" @close="showTelegramPrompt = false" />

  <!-- Buy Together pop-up: same as the one on the Notifications page -->
  <div v-if="buyItem" class="fd-entry-backdrop" @click.self="closeBuyTogether" @keydown.esc="closeBuyTogether">
    <section class="fd-entry-dialog fd-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="fd-buy-title">
      <h2 id="fd-buy-title" class="fd-page-title">Buy together</h2>
      <p class="fd-entry-description">
        {{ friendsFor(buyItem.productKey).length === 1 ? 'A friend' : 'Friends' }} saved
        <strong>{{ buyItem.name }}</strong> too. Buy it together and share the shipping.
      </p>

      <p v-if="buyError" class="alert alert-danger" role="alert">{{ buyError }}</p>

      <!-- Laid out like Items to include in Plan a budget -->
      <fieldset class="mb-4">
        <legend class="fd-hold-legend text-start mb-1">Friends to invite</legend>
        <p class="small text-secondary mb-2">Tick who to invite. They get your Telegram and can message you if
          they're keen. Pending means they already have your invite.</p>
        <ul class="fd-check-list">
          <li v-for="f in friendsFor(buyItem.productKey)" :key="f.firebaseUid">
            <!-- Already invited: shown ticked and locked, so it reads as done -->
            <input v-if="f.invited" :id="'chk-' + f.firebaseUid" type="checkbox" class="form-check-input" checked
              disabled />
            <input v-else :id="'chk-' + f.firebaseUid" v-model="selected" type="checkbox" class="form-check-input"
              :value="f.firebaseUid" />
            <label :for="'chk-' + f.firebaseUid" class="fd-check-label">
              <span>{{ f.username }}</span>
              <span v-if="f.invited" class="badge-pending">Pending</span>
            </label>
          </li>
        </ul>
      </fieldset>

      <div v-if="inviteSent" class="alert alert-success mb-3" role="status">Invite sent! They'll text you if they're interested.</div>
      <p v-else-if="allInvited(buyItem.productKey)" class="small text-secondary mb-3">
        Everyone's invited. They'll text you if they're interested.
      </p>

      <div class="fd-entry-actions">
        <button v-if="!allInvited(buyItem.productKey)" class="btn btn-dark" type="button"
          :disabled="inviting || !selected.length" @click="sendInvites">
          {{ inviting ? 'Sending…' : 'Send Invites' }}
        </button>
        <button class="btn btn-outline-dark" type="button" @click="closeBuyTogether">
          {{ inviteSent || allInvited(buyItem.productKey) ? 'Done' : 'Cancel' }}
        </button>
      </div>
    </section>
  </div>

  <!-- Purchase Verdict pop-up -->
  <div v-if="verdictItem" class="fd-entry-backdrop" @click.self="closeVerdict" @keydown.esc="closeVerdict">
    <section ref="verdictDialog" class="fd-entry-dialog" role="dialog" aria-modal="true"
      aria-labelledby="fd-verdict-title">
      <h2 id="fd-verdict-title" class="fd-page-title">
        SLEEP ON IT — VERDICT
      </h2>

      <p class="fd-entry-description">
        Your waiting period for
        <strong>{{ verdictItem.name }}</strong>
        has ended.
      </p>

      <p v-if="verdictLoading" class="alert alert-secondary">
        <FdLoadingDots size="inline" message="Checking the latest price" />
      </p>

      <p v-else-if="verdictError" class="alert alert-danger" role="alert">
        {{ verdictError }}
        <button class="btn btn-outline-dark d-block mt-2" type="button" @click="openVerdict(verdictItem)">
          Try again
        </button>
      </p>

      <template v-else-if="activeVerdict">

        <!-- Price comparison -->
        <div class="fd-verdict-prices">

          <div>
            <span>Original saved price</span>
            <strong>{{ sgd(activeVerdict.start) }}</strong>
          </div>

          <div>
            <span>Cheapest matching price found</span>
            <strong>{{ sgd(activeVerdict.latest) }}</strong>
          </div>

        </div>

        <!-- Percentage price change -->
        <div class="fd-verdict-change" :class="{
          'is-lower': activeVerdict.percent < 0,
          'is-higher': activeVerdict.percent > 0
        }">

          <strong>
            {{ activeVerdict.percent > 0 ? '+' : '' }}
            {{ activeVerdict.percent.toFixed(1) }}%
          </strong>

          <span v-if="activeVerdict.difference < 0">
            Price decreased by
            {{ sgd(-activeVerdict.difference) }}
          </span>

          <span v-else-if="activeVerdict.difference > 0">
            Price increased by
            {{ sgd(activeVerdict.difference) }}
          </span>

          <span v-else>
            Price unchanged
          </span>
        </div>

        <!-- Purchase verdict -->
        <h3 class="fd-verdict-title">
          {{ activeVerdict.title }}
        </h3>

        <p>{{ activeVerdict.message }}</p>

      </template>

      <p v-else class="alert alert-secondary">
        Latest price unavailable.
        We cannot calculate a verdict yet.
      </p>
      <button class="btn btn-dark fd-btn-lg w-100" type="button" @click="closeVerdict">
        Got it
      </button>

    </section>
  </div>


  <!-- Sleep on it pop-up. Uses the welcome prompt's dialog styles from app.css. -->
  <div v-if="sleepItem" class="fd-entry-backdrop" @click.self="closeSleep" @keydown.esc="closeSleep">
    <section ref="sleepDialog" class="fd-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-sleep-title">
      <h2 id="fd-sleep-title" class="fd-page-title">Sleep on it</h2>
      <p class="fd-entry-description">
        {{ sleepItem.name }} will be greyed out in your wishlist until the time is up, so you can decide with a clear
        head.
      </p>

      <form @submit.prevent="confirmSleep">
        <p v-if="sleepError" class="alert alert-danger" role="alert">
          {{ sleepError }}
        </p>
        <fieldset class="mb-4">
          <legend class="fd-hold-legend">Lock it for</legend>
          <div class="fd-hold-picker">
            <template v-for="(unit, i) in units" :key="unit.key">
              <span v-if="i > 0" class="fd-hold-colon" aria-hidden="true">:</span>
              <div class="fd-hold-unit">
                <label :for="'hold-' + unit.key">{{ unit.label }}</label>
                <button class="fd-hold-step" type="button" :aria-label="unit.more"
                  :disabled="holdTotal + unit.size > MAX_MINUTES" @click="stepHold(unit, 1)">
                  <FdIcon name="chevron-up" />
                </button>
                <input :id="'hold-' + unit.key" class="fd-hold-value" type="number" inputmode="numeric" min="0"
                  :value="shown(unit)" @change="onHoldInput(unit, $event)" />
                <button class="fd-hold-step" type="button" :aria-label="unit.less" :disabled="holdTotal < unit.size"
                  @click="stepHold(unit, -1)">
                  <FdIcon name="chevron-down" />
                </button>
              </div>
            </template>
          </div>
          <p class="fd-hold-end" aria-live="polite">
            <template v-if="holdMs">Locked until <strong>{{ holdEndText }}</strong></template>
            <template v-else>Pick at least 1 minute.</template>
          </p>
        </fieldset>

        <div class="fd-entry-actions">
          <button class="btn btn-dark fd-btn-lg" type="submit" :disabled="!holdMs">
            Proceed
          </button>
          <button class="btn btn-outline-dark fd-btn-lg" type="button" @click="closeSleep">Cancel</button>
        </div>
      </form>
    </section>
  </div>

  <FdConfirmDialog
    v-if="confirmRemove"
    :title="confirmRemove.kind === 'item' ? 'Remove from wishlist' : 'Delete budget'"
    :confirm-label="confirmRemove.kind === 'item' ? 'Remove' : 'Delete'"
    danger
    :busy="confirmBusy"
    :error="confirmRemove.kind === 'budget' ? draftError : ''"
    @confirm="onConfirmRemove"
    @cancel="confirmRemove = null"
  >
    <template v-if="confirmRemove.kind === 'item'">
      Remove <strong>{{ confirmRemove.name }}</strong> from your wishlist? Its target price goes too.
    </template>
    <template v-else>
      Delete the budget <strong>{{ confirmRemove.name }}</strong>? Your saved products stay on the wishlist.
    </template>
  </FdConfirmDialog>
</template>


<style scoped>
/* ===================================
   SLEEP ON IT - PURCHASE VERDICT
=================================== */

.fd-verdict-prices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin: 1.25rem 0;
}

.fd-verdict-prices>div {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1rem;
  border: 1px solid var(--fd-vanilla-line);
  border-radius: 1rem;
}

.fd-verdict-prices span {
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
}

.fd-verdict-prices strong {
  color: var(--fd-blue);
  font-size: var(--fd-section-title);
  font-family: var(--fd-font-display);
  font-weight: 400;
}

.fd-verdict-change {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  background: var(--fd-beige);
  padding: 1rem;
  border-radius: 1rem;
}

.fd-verdict-change strong {
  font-size: var(--fd-page-title);
  font-family: var(--fd-font-display);
  font-weight: 400;
}

.fd-verdict-change.is-lower {
  color: var(--fd-green-text);
}

.fd-verdict-change.is-higher {
  color: var(--fd-red-text);
}

.fd-verdict-title {
  margin: 1.25rem 0 0.5rem;
  color: var(--fd-blue);
  font-size: var(--fd-body);
  font-weight: 700;
}

@media (max-width: 460px) {
  .fd-verdict-prices {
    grid-template-columns: 1fr;
  }
}

/* ===================================
   PAGE, TABS, AND CARD
   The tabs, search, sort, empty message, and total bar are the shared ones (FdTabs,
   FdListSearch, FdEmptyState), styled in app.css like Friends and Notifications.
=================================== */

/* The column header, then the scrolling cards filling the rest of the card */
.fd-wish-table {
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
}

/* Sort by is a little wider here, for its longer options. */
.fd-wish-tools .fd-sort {
  flex-basis: 22rem;
}

/* ===================================
   WISHLIST LAYOUT
=================================== */

.fd-wish-head,
.fd-wish-row {
  /* Last column fits three icon buttons (friends, moon, trash): 3 x 2.25rem + 2 x 0.5rem gaps */
  --fd-wish-columns: minmax(0, 22rem) 9.5rem 9.5rem 12.5rem 7.75rem;
}

.fd-wish-head,
.fd-wish-row {
  display: grid;
  grid-template-columns: var(--fd-wish-columns);
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: var(--fd-row-pad);
}

/* The header pill sits above the cards, the same width as them (the page scrolls, no scrollbar). */
.fd-wish-headbar {
  margin: 0 0 0.75rem;
}

.fd-wish-head {
  white-space: nowrap;
  border-radius: 999px;
  background: var(--fd-blue);
  color: var(--fd-beige);
  font-size: var(--fd-table-header);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.fd-wish-rows {
  display: grid;
  gap: 0.75rem;
}

.fd-wish-row {
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: var(--fd-radius);
  background: var(--fd-paper);
  transition: border-color 0.15s ease;
}

/* Same blue edge on hover as the saved budget cards */
.fd-wish-row:hover {
  border-color: var(--fd-blue);
}

.fd-wish-cell {
  min-width: 0;
}

.fd-wish-label {
  display: none;
}

/* ===================================
   PRODUCT NAME AND VERDICT LINK
=================================== */

.fd-wish-cell-product {
  position: relative;
}

.fd-wish-product {
  display: flex;
  align-items: center;
  gap: 1rem;
  text-decoration: none;
}

/* On hold: not a link, so no pointer. */
span.fd-wish-product {
  cursor: default;
}

.fd-wish-product-details {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.fd-wish-cell-product .fd-verdict-link {
  display: block;
  width: fit-content;
  margin: 0.5rem 0 0 7rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--fd-blue);
  font-size: var(--fd-small);
  font-weight: 700;
  text-align: left;
  text-decoration: underline;
  cursor: pointer;
}

.fd-wish-cell-product .fd-verdict-link:hover {
  opacity: 0.8;
}

.fd-wish-image {
  /* Flex, not grid: in a grid the photo's 100% height does not resolve, so a tall photo kept its
     own height and was cut off at the bottom */
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 6rem;
  height: 6rem;
  overflow: hidden;
  border-radius: 0.75rem;
  /* White behind every product photo, like the photos' own backgrounds. */
  background: var(--fd-white);
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  font-size: var(--fd-section-title);
}

/* The whole photo always shows (contain, never cropped), with a little white space around it. */
.fd-wish-image img {
  width: 100%;
  height: 100%;
  padding: 0.5rem;
  object-fit: contain;
}

/* ===================================
   SLEEPING WISHLIST ITEMS
=================================== */

.fd-wish-row.is-asleep {
  border-color: var(--fd-grey-line);
  background: var(--fd-grey-soft);
}

.fd-wish-row.is-asleep:hover {
  border-color: var(--fd-blue);
}

.fd-wish-row.is-asleep .fd-wish-cell-product>* {
  opacity: 0.55;
  filter: grayscale(1);
}

.fd-wish-countdown {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  grid-column: 2 / -1;
}

.fd-wish-row.is-asleep .fd-wish-countdown,
.fd-wish-row.is-asleep .fd-wish-countdown .text-secondary {
  color: var(--fd-grey-text) !important;
}

/* ===================================
   PRICE DROP AND TARGET ALERT
=================================== */

.fd-drop {
  display: inline-block;
  margin-left: 0.375rem;
  padding: 0.0625rem 0.5rem;
  border-radius: 999px;
  background: var(--fd-green);
  color: var(--fd-ink);
  font-size: var(--fd-small);
  font-weight: 700;
  vertical-align: 0.0625rem;
}

.fd-best {
  display: inline-block;
  padding: 0.0625rem 0.625rem;
  border-radius: 999px;
  background: var(--fd-green);
  color: var(--fd-ink);
  font-size: var(--fd-small);
  font-weight: 700;
}

/* The AI's target as a faint hint in the box, lighter than typed text */
.fd-target-input .form-control::placeholder {
  color: var(--fd-text-muted);
  opacity: 0.45;
}

.fd-target-ai {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin: 0.375rem 0 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
  cursor: help;
}


.fd-target-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.fd-reached {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: var(--fd-control-sm);
  height: var(--fd-control-sm);
  border-radius: 50%;
  background: var(--fd-green);
  color: var(--fd-ink);
}

.fd-reached .fd-icon {
  width: 1.125rem;
  height: 1.125rem;
}

.fd-target-input {
  width: 9rem;
}

.fd-target-input .input-group-text {
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-right: 0;
  background: var(--fd-vanilla-soft);
  color: var(--fd-text-muted);
  font-weight: 700;
}

/* ACTION BUTTONS */
/* Keep the action group at the far right of the card */
.fd-wish-action-cell {
  display: flex;
  justify-content: flex-end;
  min-width: 0;
}

/* Stack the buttons above the verdict link */
.fd-wish-action-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.85rem;
  width: max-content;
}

/* Friends, moon and trash buttons stay side by side */
.fd-wish-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* "Sent!" floats above the friends button, so the button stays in line with moon and trash */
.fd-friends-wrap {
  position: relative;
}

.fd-sent {
  position: absolute;
  bottom: 100%;
  left: 50%;
  margin-bottom: 0.15rem;
  transform: translateX(-50%);
  color: var(--fd-green-text);
  font-size: var(--fd-small);
  font-weight: 700;
  white-space: nowrap;
}

/* Right-align the verdict text */
.fd-verdict-link {
  display: block;
  width: max-content;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--fd-blue);
  font-size: var(--fd-small);
  font-weight: 700;
  text-align: right;
  text-decoration: underline;
  cursor: pointer;
}

.fd-verdict-link:hover {
  opacity: 0.8;
}


/* ===================================
   RESPONSIVE LAYOUT
=================================== */

@media (max-width: 991.98px) {
  .fd-wish-headbar {
    display: none;
  }

  .fd-wish-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
    padding: 1rem;
  }

  .fd-wish-cell-product,
  .fd-wish-cell:last-child {
    grid-column: 1 / -1;
  }

  /* The countdown drops under the product here, so it centres in the card; the product stays left. */
  .fd-wish-countdown {
    justify-content: center;
    text-align: center;
  }

  .fd-wish-label {
    display: block;
    margin-bottom: 0.25rem;
    color: var(--fd-text-muted);
    font-size: var(--fd-table-header);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .fd-wish-actions {
    justify-content: flex-start;
    align-items: flex-end;
  }

  /* "Sent!" takes up space above the friends button here, so it never crosses the card's
     border; the buttons stay lined up along the bottom */
  .fd-friends-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .fd-sent {
    position: static;
    order: -1;
    margin: 0 0 0.15rem;
    transform: none;
  }
}

/* Phones: the saved price and the best price side by side, so they are easy to compare;
   under them the target alert, with the buttons beside it lined up on its input. */
@media (max-width: 767.98px) {
  .fd-wish-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .fd-wish-countdown {
    grid-column: 1 / -1;
  }

  .fd-wish-cell.fd-wish-action-cell {
    grid-column: auto;
    align-self: end;
  }

  .fd-wish-action-cell .fd-wish-actions {
    justify-content: flex-end;
  }

  .fd-wish-image {
    width: 4.5rem;
    height: 4.5rem;
    font-size: var(--fd-section-title);
  }

  .fd-wish-cell-product .fd-verdict-link {
    margin-left: 5.5rem;
  }
}

/* ===================================
   BUDGET BAR AND MODAL
=================================== */

/* New budget: bottom right of the card, in the list's column, so it ends where the Sort by
   menu ends and the scrollbar runs past it to the bottom. */
.fd-budget-add {
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
}

.fd-budget-new {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.fd-budget-new .fd-icon {
  width: 1.125rem;
  height: 1.125rem;
}

/* From md down: a round plus button, the size of a full button */
@media (max-width: 991.98px) {
  .fd-budget-new {
    justify-content: center;
    width: var(--fd-control);
    height: var(--fd-control);
    padding: 0;
    border-radius: 50%;
  }

  .fd-budget-new .fd-icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  .fd-budget-new-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
}



/* Your budgets list */
/* Plan a budget tab: the search and sort row sits inside the scrolling area, so it does not
   need to leave room for the scrollbar's column */
.fd-drafts-tools {
  align-items: center;
  margin-right: 0;
}

.fd-drafts {
  display: grid;
  gap: 0.75rem;
}

.fd-draft {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: var(--fd-radius);
  background: var(--fd-paper);
  transition: border-color 0.15s ease;
}

.fd-draft:hover {
  border-color: var(--fd-blue);
}

.fd-draft-open {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--fd-text);
  text-align: left;
}

.fd-draft-name {
  overflow: hidden;
  color: var(--fd-blue);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Left edge, like the budget field and the other labels in the pop-up */
.fd-draft-name-form {
  max-width: 26rem;
  margin-top: 1rem;
  text-align: left;
}

.fd-budget-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0.25rem;
  margin: 1rem 0 0;
}

/* Same as Forgot password? on the login page */
.fd-draft-link {
  color: var(--fd-blue);
  font-size: var(--fd-small);
  vertical-align: baseline;
}

.fd-budget-input {
  max-width: 14rem;
}

.fd-budget-input .form-control::placeholder {
  color: var(--fd-text-muted);
  opacity: 0.45;
}

.fd-budget-input .input-group-text {
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-right: 0;
  background: var(--fd-vanilla-soft);
  color: var(--fd-text-muted);
  font-weight: 700;
}

.fd-budget-pick {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Priority number beside a ticked item. */
.fd-rank {
  flex-shrink: 0;
  width: 4.5rem;
}

.fd-budget-result {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--fd-vanilla-line);
}

.fd-budget-pick li {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--fd-vanilla-line);
}

/* The result already has padding under its top line, so the first row adds none */
.fd-budget-pick li:first-child {
  padding-top: 0;
}

.fd-budget-total {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 1rem 0;
  color: var(--fd-text-muted);
}

.fd-budget-total strong {
  color: var(--fd-blue);
  font-size: var(--fd-body);
}

/* ===================================
   SLEEP ON IT TIMER
=================================== */

.fd-hold-legend {
  margin-bottom: 1rem;
  color: var(--fd-text);
  font-size: var(--fd-body);
  font-weight: 700;
  text-align: center;
}

.fd-hold-picker {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.fd-hold-unit {
  display: grid;
  justify-items: center;
  gap: 0.25rem;
}

.fd-hold-unit label {
  margin-bottom: 0.25rem;
  color: var(--fd-text-muted);
}

.fd-hold-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 2.75rem;
  border: 0;
  border-radius: var(--fd-radius);
  background: transparent;
  color: var(--fd-blue);
}

.fd-hold-step:hover:not(:disabled) {
  background: var(--fd-vanilla-soft);
}

.fd-hold-step:disabled {
  color: var(--fd-vanilla-line);
}

.fd-hold-value {
  width: 4.75rem;
  padding: 0.5rem 0.25rem;
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: var(--fd-radius);
  background: var(--fd-beige);
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  font-size: var(--fd-page-title);
  line-height: 1.1;
  text-align: center;
  appearance: textfield;
  -moz-appearance: textfield;
}

.fd-hold-value::-webkit-outer-spin-button,
.fd-hold-value::-webkit-inner-spin-button {
  margin: 0;
  -webkit-appearance: none;
}

.fd-hold-value:focus {
  outline: 3px solid var(--fd-blue);
  outline-offset: 2px;
}

.fd-hold-colon {
  margin-top: 1.75rem;
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  font-size: var(--fd-page-title);
}

.fd-hold-end {
  margin: 1.25rem 0 0;
  color: var(--fd-text-muted);
  text-align: center;
}

.fd-hold-end strong {
  color: var(--fd-blue);
}

</style>
