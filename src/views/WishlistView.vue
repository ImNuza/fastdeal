<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { cheapestListing, productImage, sgd, storeLink } from '../mock/catalog.js'
import {addSampleWishlist, isAsleep, missingSamples, removeSaved, setTarget, sleepOn, markSleepVerdictSeen, user} from '../mock/session.js'
import FdIcon from '../components/FdIcon.vue'
import { planBudget } from '../mock/budget.js'

const router = useRouter()

if (!user.value) {
  router.replace('/login?next=/wishlist')
}

// Ticks every 30 seconds so the "left" countdown on held items stays current.
const now = ref(Date.now())
let clock = 0

onMounted(function () {
  clock = window.setInterval(function () {
    now.value = Date.now()
  }, 30000)
})

onBeforeUnmount(function () {
  window.clearInterval(clock)
})

function best(item) {
  return cheapestListing(item.name)
}

// A price drop worth flagging: some store now sells it for at least 10% less than the saved price.
// Smaller drops are left out so the tag only shows for real savings.
const DROP_PERCENT = 10

function cheaper(item) {
  return saving(item) / item.savedPrice * 100 >= DROP_PERCENT
}

function saving(item) {
  return item.savedPrice - best(item).price
}

// How much lower the best price is than the saved price, as a whole percent.
function savingPercent(item) {
  return Math.round((saving(item) / item.savedPrice) * 100)
}

function reached(item) {
  return best(item).price <= Number(item.targetPrice)
}

function asleep(item) {
  return isAsleep(item.name, now.value)
}

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

// Total for the bottom bar: how many are saved and sleeping, or how many a search shows.
const sleepingCount = computed(function () {
  return user.value ? user.value.wishlist.filter(asleep).length : 0
})

const countText = computed(function () {
  const total = user.value ? user.value.wishlist.length : 0
  const noun = total === 1 ? 'product' : 'products'
  if (query.value.trim()) {
    return shownItems.value.length + ' of ' + total + ' ' + noun + ' shown'
  }
  return 'Total: ' + total + ' ' + noun + (sleepingCount.value ? ' (' + sleepingCount.value + ' sleeping)' : '')
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
  cheap: function (a, b) { return best(a).price - best(b).price },
  pricey: function (a, b) { return best(b).price - best(a).price },
  az: function (a, b) { return a.name.localeCompare(b.name) },
  za: function (a, b) { return b.name.localeCompare(a.name) }
}

const shownItems = computed(function () {
  if (!user.value) {
    return []
  }
  const words = query.value.trim().toLowerCase()
  return user.value.wishlist
    .filter(function (item) { return item.name.toLowerCase().includes(words) })
    .sort(sorters[sortBy.value])
})

// Placeholder for products without a photo: the first letter of the first two words.
function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(function (word) { return word.charAt(0) }).join('').toUpperCase()
}

function onTarget(item, event) {
  setTarget(item.name, event.target.value)
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
  if (!holdMs.value) {
    return
  }

  // NEW: Capture the product's price when Sleep On It begins
  const priceAtStart = Number(best(sleepItem.value)?.price)

  sleepOn(
    sleepItem.value.name,
    holdMs.value / 3600000,
    priceAtStart
  )

  closeSleep()
}

// =====================================
// SLEEP ON IT - PURCHASE VERDICT
// =====================================

// Which product's verdict is currently displayed?
const verdictItem = ref(null)
const verdictDialog = ref(null)

// Check whether the Sleep On It timer has expired
function hasFinishedSleep(item) {
  return Boolean(
    item.sleepUntil &&
    item.sleepUntil <= now.value &&
    Number.isFinite(item.sleepPriceAtStart) &&
    item.sleepPriceAtStart > 0
  )
}

// Calculate the percentage change and purchase verdict
function verdictData(item) {
  const start = item.sleepPriceAtStart
  const latest = Number(best(item)?.price)

  // Cannot calculate a verdict without valid prices
  if (!Number.isFinite(latest) || latest < 0) {
    return null
  }

  // Percentage change formula
  const percent = ((latest - start) / start) * 100

  // Absolute price difference
  const difference = latest - start

  let title = ''
  let message = ''

  if (percent <= -10) {
    title = 'A more favourable price — worth considering'
    message =
      'The price has dropped by at least 10% since you started waiting. ' +
      'If you still need this product, now may be a better time to buy.'

  } else if (percent < 0) {
    title = 'A small saving since you waited'
    message =
      'The price has decreased slightly. Consider whether the savings ' +
      'make the purchase worthwhile.'

  } else if (percent === 0) {
    title = 'No price advantage yet'
    message =
      'The price has not changed since you started waiting. ' +
      'There is no price-based reason to rush your decision.'

  } else {
    title = 'The price has increased — consider waiting'
    message =
      'The product now costs more than when you started waiting. ' +
      'Consider comparing alternatives or waiting for a better offer.'
  }

  return {
    start,
    latest,
    percent,
    difference,
    title,
    message
  }
}

// Automatically calculate the currently displayed verdict
const activeVerdict = computed(() => {
  return verdictItem.value
    ? verdictData(verdictItem.value)
    : null
})

// Open the Purchase Verdict pop-up
function openVerdict(item) {
  verdictItem.value = item

  nextTick(() => {
    verdictDialog.value?.querySelector('button')?.focus()
  })
}

// Close the pop-up and mark the verdict as viewed
function closeVerdict() {
  if (verdictItem.value) {
    markSleepVerdictSeen(verdictItem.value.name)
  }

  verdictItem.value = null
}

// Watch for expired timers
watch(
  [now, () => user.value?.wishlist],
  function () {
    if (verdictItem.value || sleepItem.value || !user.value) {
      return
    }

    // Find the first expired timer that has not been viewed
    const newlyFinished = user.value.wishlist.find(item =>
      hasFinishedSleep(item) && !item.sleepVerdictSeen
    )

    if (newlyFinished) {
      openVerdict(newlyFinished)
    }
  },
  {
    immediate: true,
    deep: true
  }
)


// Plan a budget pop-up: tick must haves, enter a budget, then see the best mix at today's best prices.
// Items on hold are left out, since they are still being slept on.
const showBudget = ref(false)
const budget = ref('')
const mustHaves = ref([])
const plan = ref(null)
const planIndex = ref(0)
const budgetInput = ref(null)
let budgetOpener = null

const plannable = computed(function () {
  return user.value ? user.value.wishlist.filter(function (item) { return !asleep(item) }) : []
})

const heldCount = computed(function () {
  return user.value ? user.value.wishlist.length - plannable.value.length : 0
})

const budgetError = ref('')

function openBudget(event) {
  budgetOpener = event.currentTarget
  plan.value = null
  budgetError.value = ''
  mustHaves.value = mustHaves.value.filter(function (name) {
    return plannable.value.some(function (item) { return item.name === name })
  })
  showBudget.value = true
  nextTick(() => budgetInput.value?.focus())
}

function closeBudget() {
  showBudget.value = false
  nextTick(() => budgetOpener?.focus())
}

// Any change to the budget or must haves clears the old answer, so it never shows a stale mix.
function clearPlan() {
  plan.value = null
  budgetError.value = ''
}

function findPlan() {
  const amount = Number(budget.value)
  if (!amount || amount <= 0) {
    budgetError.value = 'Enter a budget above S$0.'
    plan.value = null
    return
  }
  if (!mustHaves.value.length) {
    budgetError.value = 'Tick at least one item you want.'
    plan.value = null
    return
  }
  // Only the ticked items go into the search; nothing else from the wishlist is added.
  const items = plannable.value.filter(function (item) {
    return rankOf(item.name) > 0
  }).map(function (item) {
    const now = best(item)
    return { name: item.name, price: now.price, store: now.store, rank: mustHaves.value.indexOf(item.name) + 1 }
  })
  plan.value = planBudget(items, amount, 5)
  planIndex.value = 0
}

function nextOption() {
  planIndex.value = (planIndex.value + 1) % plan.value.options.length
}

const option = computed(function () {
  return plan.value && plan.value.options.length ? plan.value.options[planIndex.value] : null
})

// Must haves are ranked by their place in mustHaves: ticking one adds it at the bottom,
// and picking a number moves it to that place, so no two share a rank.
function rankOf(name) {
  return mustHaves.value.indexOf(name) + 1
}

function setRank(name, event) {
  const list = mustHaves.value.filter(function (other) { return other !== name })
  list.splice(Number(event.target.value) - 1, 0, name)
  mustHaves.value = list
  clearPlan()
}

// The picked items with must haves first, in priority order, then the rest.
const pickedItems = computed(function () {
  if (!option.value) {
    return []
  }
  return option.value.items.slice().sort(function (a, b) {
    return (a.rank || Infinity) - (b.rank || Infinity)
  })
})

// Ticked items that did not make it into this option, when they could not all fit together.
const missedMustHaves = computed(function () {
  if (!option.value) {
    return []
  }
  return mustHaves.value.filter(function (name) {
    return !option.value.items.some(function (item) { return item.name === name })
  })
})

// The cheapest ticked item, for the "Nothing fits" message.
function cheapestPlannable() {
  return plannable.value.filter(function (item) {
    return rankOf(item.name) > 0
  }).reduce(function (low, item) {
    return !low || best(item).price < best(low).price ? item : low
  }, null)
}
</script>

<template>
  <div v-if="user">
    <h1 class="fd-page-title">Wishlist</h1>
    <p class="fd-page-subtitle">Your saved price and store next to the best price now. A cheaper store is marked as a price drop. Not sure yet? Sleep on it and the item rests until you are ready.</p>

    <p v-if="!user.wishlist.length" class="alert alert-secondary">No saved products. Search, then press Save.</p>

    <template v-else>
      <div class="fd-wish-tools">
        <!-- Built like the Home search bar: one pill with the search icon inside, minus the photo search. -->
        <div class="fd-wish-search">
          <input v-model="query" class="fd-wish-search-input" type="text" placeholder="Search your wishlist" aria-label="Search your wishlist" autocomplete="off" />
          <span class="fd-wish-search-icon" aria-hidden="true">
            <FdIcon name="search" />
          </span>
        </div>
        <div class="fd-wish-sort">
          <label for="wish-sort">Sort by</label>
          <select id="wish-sort" v-model="sortBy" class="form-select">
            <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>

      <!-- A table built from rows of cards: the header floats as a pill and stays under the navbar
           while scrolling, each product is its own card. Roles keep it a table for screen readers. -->
      <div v-if="shownItems.length" class="fd-wish-table mb-4" role="table" aria-label="Saved products">
        <div class="fd-wish-headbar" role="rowgroup">
          <div class="fd-wish-head" role="row">
            <span role="columnheader">Product</span>
            <span role="columnheader">Saved price</span>
            <span role="columnheader">Best now</span>
            <span role="columnheader">Target price alert</span>
            <span role="columnheader"><span class="visually-hidden">Actions</span></span>
          </div>
        </div>

        <div class="fd-wish-rows" role="rowgroup">
          <div v-for="item in shownItems" :key="item.name" class="fd-wish-row" :class="{ 'is-asleep': asleep(item) }" role="row">
            <div class="fd-wish-cell fd-wish-cell-product" role="cell">
              <router-link class="fd-wish-product" :to="{ path: '/compare', query: { q: item.name } }">
                <span class="fd-wish-image">
                  <img v-if="productImage(item.name)" :src="productImage(item.name)" alt="" />
                  <span v-else>{{ initials(item.name) }}</span>
                </span>
                <span class="fd-section-subtitle mb-0">{{ item.name }}</span>
              </router-link>
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
                <a v-if="item.savedStore" class="d-block small" :href="storeLink(item.savedStore, item.name)" target="_blank" rel="noopener">{{ item.savedStore }}</a>
                <span v-else class="d-block small text-secondary">Store not recorded</span>
              </div>
              <div class="fd-wish-cell" role="cell">
                <span class="fd-wish-label" aria-hidden="true">Best now</span>
                <strong>{{ sgd(best(item).price) }}</strong>
                <span v-if="cheaper(item)" class="fd-drop" :title="'Price drop, ' + sgd(saving(item)) + ' less'">
                  <span aria-hidden="true">&minus;{{ savingPercent(item) }}%</span>
                  <span class="visually-hidden">, price drop of {{ savingPercent(item) }}%, {{ sgd(saving(item)) }} less</span>
                </span>
                <a class="d-block small" :href="storeLink(best(item).store, item.name)" target="_blank" rel="noopener">{{ best(item).store }}</a>
              </div>
              <div class="fd-wish-cell" role="cell">
                <span class="fd-wish-label" aria-hidden="true">Target price alert</span>
                <div class="fd-target-row">
                  <div class="input-group fd-target-input">
                    <span class="input-group-text">S$</span>
                    <input
                      :id="'target-' + item.name"
                      class="form-control"
                      type="number"
                      min="0"
                      step="0.01"
                      :value="item.targetPrice"
                      :aria-label="'Target price for ' + item.name"
                      @change="onTarget(item, $event)"
                    />
                  </div>
                  <span v-if="reached(item)" class="fd-reached" role="img" aria-label="Target reached" title="Target reached">
                    <FdIcon name="check" />
                  </span>
                </div>
              </div>
              <div class="fd-wish-cell fd-wish-action-cell" role="cell">
               <div class="fd-wish-action-group">

                  <!-- Moon and trash buttons -->
                  <div class="fd-wish-actions">
                    <button class="btn btn-outline-dark btn-sm fd-icon-btn" type="button"
                      :aria-label="'Sleep on ' + item.name" title="Sleep on it" @click="openSleep(item, $event)">
                      <FdIcon name="moon" />
                    </button>

                    <button class="btn btn-outline-danger btn-sm fd-icon-btn" type="button"
                      :aria-label="'Remove ' + item.name" @click="removeSaved(item.name)">
                      <FdIcon name="trash" />
                    </button>
                  </div>

                  <!-- Verdict link directly below the icons -->
                  <button v-if="hasFinishedSleep(item)" class="fd-verdict-link" type="button"
                    @click="openVerdict(item)">
                    View purchase verdict
                  </button>

                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <p v-else class="alert alert-secondary mb-4">No saved products match "{{ query }}".</p>
    </template>

    <p v-if="missingSamples()" class="fd-entry-signup">
      Want to see how it works?
      <button class="btn btn-link p-0 fd-sample-link" type="button" @click="addSampleWishlist">Add {{ missingSamples() }} sample products</button>
    </p>

    <!-- Last in the page so it can stick to the bottom of the screen and stop above the footer. -->
    <div v-if="user.wishlist.length" class="fd-budget-bar">
      <button class="btn btn-dark" type="button" @click="openBudget">Plan a budget</button>
      <p class="fd-budget-count" aria-live="polite">{{ countText }}</p>
    </div>
  </div>

  <!-- Plan a budget pop-up. Uses the welcome prompt's dialog styles from app.css. -->
  <div v-if="showBudget" class="fd-entry-backdrop" @click.self="closeBudget" @keydown.esc="closeBudget">
    <section class="fd-entry-dialog fd-budget-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-budget-title">
      <h2 id="fd-budget-title" class="fd-page-title">Plan a budget</h2>
      <p class="fd-entry-description">Tick what you want most, set your budget, and see the best mix of your wishlist at today's best prices.</p>

      <form @submit.prevent="findPlan">
        <label class="fd-hold-legend d-block text-start" for="budget-amount">Your budget</label>
        <div class="input-group fd-budget-input mb-4">
          <span class="input-group-text">S$</span>
          <input
            id="budget-amount"
            ref="budgetInput"
            v-model="budget"
            class="form-control"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="1000"
            @input="clearPlan"
          />
        </div>

        <fieldset class="mb-4">
          <legend class="fd-hold-legend text-start mb-1">Items to include</legend>
          <p class="small text-secondary mb-2">Tick the items you want in the calculation, then rank them: 1 is the highest priority. If they cannot all fit, higher priorities go in first.</p>
          <ul class="fd-budget-items">
            <li v-for="item in plannable" :key="item.name">
              <input
                :id="'must-' + item.name"
                v-model="mustHaves"
                class="form-check-input"
                type="checkbox"
                :value="item.name"
                @change="clearPlan"
              />
              <label class="fd-budget-item-label" :for="'must-' + item.name">
                <span>{{ item.name }}</span>
              </label>
              <select
                v-if="rankOf(item.name)"
                class="form-select fd-rank"
                :value="rankOf(item.name)"
                :aria-label="'Priority for ' + item.name + ', 1 is highest'"
                @change="setRank(item.name, $event)"
              >
                <option v-for="n in mustHaves.length" :key="n" :value="n">{{ n }}</option>
              </select>
            </li>
          </ul>
          <p v-if="heldCount" class="small text-secondary mt-2 mb-0">{{ heldCount }} {{ heldCount === 1 ? 'item is' : 'items are' }} on hold and left out.</p>
        </fieldset>

        <p v-if="budgetError" class="alert alert-danger mb-3">{{ budgetError }}</p>

        <div class="fd-entry-actions">
          <button class="btn btn-dark fd-btn-lg" type="submit" :disabled="!plannable.length">Find best combination</button>
        </div>
      </form>

      <section v-if="plan" class="fd-budget-result" aria-live="polite">
        <template v-if="option">
          <p v-if="!plan.mustFits" class="alert alert-secondary mb-3">
            Your ticked items come to {{ sgd(plan.mustTotal) }}, which is over your budget, so not all of them fit.
            <template v-if="missedMustHaves.length">This mix leaves out {{ missedMustHaves.join(', ') }}.</template>
          </p>
          <p v-if="planIndex === 0" class="mb-2"><span class="fd-best">Best combination</span></p>
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
          <button v-if="plan.options.length > 1" class="btn btn-dark fd-btn-lg w-100 mb-2" type="button" @click="nextOption">Try another combination</button>
        </template>
        <p v-else class="alert alert-secondary mb-3">
          Nothing fits in {{ sgd(Number(budget)) }}.
          <template v-if="cheapestPlannable()">The cheapest item is {{ cheapestPlannable().name }} at {{ sgd(best(cheapestPlannable()).price) }}.</template>
        </p>
      </section>

      <button class="btn btn-outline-dark fd-btn-lg w-100 mt-2" type="button" @click="closeBudget">Close</button>
    </section>
  </div>

<!-- Purchase Verdict pop-up -->
<div
  v-if="verdictItem"
  class="fd-entry-backdrop"
  @click.self="closeVerdict"
  @keydown.esc="closeVerdict"
>
  <section
    ref="verdictDialog"
    class="fd-entry-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="fd-verdict-title"
  >
    <h2 id="fd-verdict-title" class="fd-page-title">
      SLEEP ON IT — VERDICT
    </h2>

    <p class="fd-entry-description">
      Your waiting period for
      <strong>{{ verdictItem.name }}</strong>
      has ended.
    </p>

    <template v-if="activeVerdict">

      <!-- Price comparison -->
      <div class="fd-verdict-prices">

        <div>
          <span>Price when sleep started</span>
          <strong>{{ sgd(activeVerdict.start) }}</strong>
        </div>

        <div>
          <span>Latest listed price</span>
          <strong>{{ sgd(activeVerdict.latest) }}</strong>
        </div>

      </div>

      <!-- Percentage price change -->
      <div
        class="fd-verdict-change"
        :class="{
          'is-lower': activeVerdict.percent < 0,
          'is-higher': activeVerdict.percent > 0
        }"
      >
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

    <p class="small text-secondary">
      Currently based on FastDeal's demo catalogue.
      This verdict reflects price movement only.
    </p>

    <button
      class="btn btn-dark fd-btn-lg w-100"
      type="button"
      @click="closeVerdict"
    >
      Got it
    </button>

  </section>
</div>


  <!-- Sleep on it pop-up. Uses the welcome prompt's dialog styles from app.css. -->
  <div v-if="sleepItem" class="fd-entry-backdrop" @click.self="closeSleep" @keydown.esc="closeSleep">
    <section ref="sleepDialog" class="fd-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-sleep-title">
      <h2 id="fd-sleep-title" class="fd-page-title">Sleep on it</h2>
      <p class="fd-entry-description">
        {{ sleepItem.name }} will be greyed out in your wishlist until the time is up, so you can decide with a clear head.
      </p>

      <form @submit.prevent="confirmSleep">
        <fieldset class="mb-4">
          <legend class="fd-hold-legend">Lock it for</legend>
          <div class="fd-hold-picker">
            <template v-for="(unit, i) in units" :key="unit.key">
              <span v-if="i > 0" class="fd-hold-colon" aria-hidden="true">:</span>
              <div class="fd-hold-unit">
                <label :for="'hold-' + unit.key">{{ unit.label }}</label>
                <button class="fd-hold-step" type="button" :aria-label="unit.more" :disabled="holdTotal + unit.size > MAX_MINUTES" @click="stepHold(unit, 1)">
                  <FdIcon name="chevron-up" />
                </button>
                <input :id="'hold-' + unit.key" class="fd-hold-value" type="number" inputmode="numeric" min="0" :value="shown(unit)" @change="onHoldInput(unit, $event)" />
                <button class="fd-hold-step" type="button" :aria-label="unit.less" :disabled="holdTotal < unit.size" @click="stepHold(unit, -1)">
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
          <button class="btn btn-dark fd-btn-lg" type="submit" :disabled="!holdMs">Proceed</button>
          <button class="btn btn-outline-dark fd-btn-lg" type="button" @click="closeSleep">Cancel</button>
        </div>
      </form>
    </section>
  </div>
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

.fd-verdict-prices > div {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1rem;
  border: 1px solid var(--fd-vanilla-line);
  border-radius: 1rem;
}

.fd-verdict-prices span {
  color: var(--fd-text-muted);
  font-size: 0.85rem;
}

.fd-verdict-prices strong {
  color: var(--fd-blue);
  font-size: 1.4rem;
}

.fd-verdict-change {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  background: #f4f0e8;
  padding: 1rem;
  border-radius: 1rem;
}

.fd-verdict-change strong {
  font-size: 2rem;
}

.fd-verdict-change.is-lower {
  color: #187447;
}

.fd-verdict-change.is-higher {
  color: #a24432;
}

.fd-verdict-title {
  margin: 1.25rem 0 0.5rem;
  color: var(--fd-blue);
  font-size: 1.15rem;
  font-weight: 700;
}

@media (max-width: 460px) {
  .fd-verdict-prices {
    grid-template-columns: 1fr;
  }
}

/* ===================================
   WISHLIST SEARCH AND SORT
=================================== */

.fd-wish-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.fd-wish-search {
  display: flex;
  flex: 1 1 16rem;
  align-items: center;
  gap: 0.25rem;
  min-height: var(--fd-control);
  padding: 0.25rem 0.25rem 0.25rem 1.5rem;
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: 999px;
  background: var(--fd-paper);
}

.fd-wish-search:focus-within {
  border-color: var(--fd-blue);
  box-shadow: 0 0 0 0.25rem rgb(39 80 138 / 35%);
}

.fd-wish-search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--fd-text);
  font-size: var(--fd-body);
  outline: none;
}

.fd-wish-search-input::placeholder {
  color: var(--fd-text-muted);
}

.fd-wish-search-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  color: var(--fd-blue);
}

.fd-wish-sort {
  display: flex;
  flex: 0 1 22rem;
  align-items: center;
  gap: 0.75rem;
}

.fd-wish-sort label {
  flex-shrink: 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
  font-weight: 700;
}

@media (min-width: 992px) {
  .fd-wish-tools {
    display: grid;
    grid-template-columns: var(--fd-wish-columns);
    justify-content: space-between;
    column-gap: 1rem;
    padding: 0 1.25rem;
  }

  .fd-wish-search {
    grid-column: 1 / 4;
    margin-left: -1.25rem;
  }

  .fd-wish-sort {
    grid-column: 4 / -1;
    margin-right: -1.25rem;
  }
}

.fd-wish-tools .form-select {
  flex: 1 1 auto;
  min-height: var(--fd-control);
  padding: 0.375rem 3.25rem 0.375rem 1.5rem;
  border-radius: 999px;
  background-position: right 1.25rem center;
  font-size: var(--fd-body);
}

/* ===================================
   WISHLIST LAYOUT
=================================== */

.fd-wish-tools,
.fd-wish-head,
.fd-wish-row {
  --fd-wish-columns: minmax(0, 22rem) 9.5rem 9.5rem 12.5rem 5rem;
}

.fd-wish-head,
.fd-wish-row {
  display: grid;
  grid-template-columns: var(--fd-wish-columns);
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
}

.fd-wish-headbar {
  position: sticky;
  top: var(--fd-nav-height);
  z-index: 5;
  padding: 1.5rem 0 0.75rem;
  border-top: var(--fd-border) solid var(--fd-vanilla-line);
  background: var(--fd-beige);
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
  font-size: 0.8rem;
  font-weight: 700;
  text-align: left;
  text-decoration: underline;
  cursor: pointer;
}

.fd-wish-cell-product .fd-verdict-link:hover {
  opacity: 0.8;
}

.fd-wish-image {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 6rem;
  height: 6rem;
  overflow: hidden;
  border-radius: 0.75rem;
  background: var(--fd-vanilla-soft);
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  font-size: 2rem;
}

.fd-wish-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ===================================
   SLEEPING WISHLIST ITEMS
=================================== */

.fd-wish-row.is-asleep {
  border-color: var(--fd-grey-line);
  background: var(--fd-grey-soft);
}

.fd-wish-row.is-asleep .fd-wish-cell-product > * {
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

/* Moon and trash buttons stay side by side */
.fd-wish-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
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
  font-size: 0.8rem;
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

  .fd-wish-rows {
    padding-top: 1.5rem;
    border-top: var(--fd-border) solid var(--fd-vanilla-line);
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

  .fd-wish-countdown {
    justify-content: flex-start;
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
  }
}

@media (max-width: 767.98px) {
  .fd-wish-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .fd-wish-image {
    width: 4.5rem;
    height: 4.5rem;
    font-size: 1.5rem;
  }

  .fd-wish-cell-product .fd-verdict-link {
    margin-left: 5.5rem;
  }
}

/* ===================================
   BUDGET BAR AND MODAL
=================================== */

.fd-budget-bar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.75rem 0;
  border-top: var(--fd-border) solid var(--fd-vanilla-line);
  background: var(--fd-beige);
}

.fd-budget-count {
  margin: 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
}

.fd-budget-dialog {
  width: min(100%, 38rem);
  max-height: calc(100svh - 2rem);
  overflow-y: auto;
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

.fd-budget-items,
.fd-budget-pick {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fd-budget-items li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid var(--fd-vanilla-line);
}

.fd-budget-items .form-check-input {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  margin: 0;
}

.fd-rank {
  flex-shrink: 0;
  width: 4.5rem;
}

.fd-budget-item-label {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  min-height: 3rem;
  padding: 0.5rem 0;
  align-items: center;
  cursor: pointer;
}

.fd-budget-result {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
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
  font-size: 1.25rem;
}

.fd-sample-link {
  font-size: inherit;
  font-weight: 700;
  vertical-align: baseline;
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
  font-size: 2.25rem;
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
  font-size: 2.5rem;
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
