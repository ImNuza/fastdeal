<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FdSearchBar from '../components/FdSearchBar.vue'
import FdIcon from '../components/FdIcon.vue'
import FdBelt from '../components/FdBelt.vue'
import { itemName } from '../services/itemName.js'
import axios from 'axios'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useTrendingStore } from '../store/trending.js'

// Trending cards whose photo is missing or failed to load show the product's initials instead,
// like the wishlist does.
const brokenImages = ref({})

function showImage(item) {
  return Boolean(item.image) && !brokenImages.value[item.query]
}

function initials(name) {
  return String(name || '').split(/\s+/).slice(0, 2).map(function (word) { return word.charAt(0) }).join('').toUpperCase()
}

// The values band under the hero: FastDeal's features in four groups. ai marks the AI-powered one.
const values = [
  { icon: 'sparkles', title: 'Photo search', text: 'Snap it, AI finds it.', ai: true },
  { icon: 'scale', title: 'Compare', text: 'Every store, cheapest first, AI verdict.' },
  { icon: 'wallet', title: 'Plan', text: 'Wishlist and budget planner.' },
  { icon: 'moon', title: 'Decide', text: 'Sleep on it, or buy with friends.' }
]

// Trending lists come from the trending store, shared with the Trending page and the search bar.
const trendingStore = useTrendingStore()
const { topToday: trendingToday, todayFrom: trendingFrom, weekExtras: trendingWeek } = storeToRefs(trendingStore)

// Trending This Week: the top 10, one big card at a time.
// Arrows, a swipe, the arrow keys, or tapping a side card pick the card; both ends wrap around.
const WEEK_MAX = 10
const weekTop = computed(function () {
  return trendingWeek.value.slice(0, WEEK_MAX)
})
const weekActive = ref(0)
const weekItem = computed(function () {
  return weekTop.value[weekActive.value] || weekTop.value[0]
})

// Wide screens show the whole top 10 as a row that glides one card over. Tapping the middle card
// opens Compare; tapping one either side brings it to the middle instead.
const router = useRouter()

function weekLink(item) {
  return { path: '/compare', query: { q: item.query } }
}

// How far a card sits from the middle one, going the short way round, so the row loops:
// with #1 in the middle, #10 sits on its left.
function reelOffset(index) {
  const count = weekTop.value.length
  let offset = (index - weekActive.value + count) % count
  if (offset > count / 2) {
    offset -= count
  }
  return offset
}

function openReel(index) {
  if (index === weekActive.value) {
    router.push(weekLink(weekTop.value[index]))
  } else {
    showWeek(index)
  }
}

function showWeek(index) {
  const count = weekTop.value.length
  if (!count) {
    return
  }
  weekActive.value = (index + count) % count
}

let swipeStart = null

function onDeckTouchStart(event) {
  swipeStart = event.touches[0].clientX
}

function onDeckTouchEnd(event) {
  if (swipeStart === null) {
    return
  }
  const moved = event.changedTouches[0].clientX - swipeStart
  swipeStart = null
  if (Math.abs(moved) > 40) {
    showWeek(weekActive.value + (moved < 0 ? 1 : -1))
  }
}

watch(weekTop, function () {
  if (weekActive.value >= weekTop.value.length) {
    weekActive.value = 0
  }
})

// Hero

// The hero cards help a shopper decide where and when to buy, straight from our own data
// (/api/home-stats): how much comparing stores pays, the next big sale, and real price drops on
// wishlists. Seed data stays in the database but is left out. A card with no data stays hidden;
// with none at all, the whole cluster does.
const stats = ref(null)

onMounted(async function loadHomeStats() {
  try {
    const res = await axios.get('/api/home-stats')
    stats.value = res.data
  } catch (error) {
    stats.value = null
  }
})

function money(n) {
  return 'S$' + Math.round(n).toLocaleString('en-SG')
}

// Comparing pays: one product (the top trending one with 3 store prices), the saving between its
// cheapest and priciest store, and three of its stores (cheapest, median, priciest), each bar
// sized against the priciest price.
const comparing = computed(function () {
  const c = stats.value && stats.value.comparing
  if (!c || !c.example) {
    return null
  }
  const labels = ['Cheapest', 'Median', 'Priciest']
  const high = c.example.stores[c.example.stores.length - 1].price
  const low = c.example.stores[0].price
  return {
    // The saving on this item: its priciest store minus its cheapest.
    gap: high - low,
    name: itemName(c.example.name),
    rows: c.example.stores.map(function (st, i) {
      return { label: labels[i], store: st.store, price: st.price, width: (st.price / high) * 100 }
    })
  }
})

const nextSale = computed(function () {
  return stats.value && stats.value.nextSale
})

// "In 12 days. Shopee and Lazada usually join. Not urgent? It may be worth waiting."
const saleText = computed(function () {
  const sale = nextSale.value
  if (!sale) {
    return ''
  }
  const when = sale.daysAway === 0 ? 'Today.' : sale.daysAway === 1 ? 'Tomorrow.' : 'In ' + sale.daysAway + ' days.'
  const who = sale.stores.length ? ' ' + sale.stores.join(' and ') + ' usually join.' : ''
  return when + who + ' Not urgent? It may be worth waiting.'
})

const drops = computed(function () {
  return ((stats.value && stats.value.drops) || []).slice(0, 3)
})

// How many products dropped beyond the 3 shown.
const moreDrops = computed(function () {
  return (stats.value && stats.value.moreDrops) || 0
})

// Shown in the third card while there are no believable price drops.
const mostSaved = computed(function () {
  return ((stats.value && stats.value.mostSaved) || []).map(function (m) {
    return { name: itemName(m.name), count: m.count }
  })
})

// Cards fly out to the right as the hero scrolls away.
// Each card leaves during its own slice of the scroll, so the small edge cards go first
// and the big chart goes last. Values are fractions of the hero's height.
const exitWindows = [
  { name: '--p-stores', start: 0.05, end: 0.6 },
  { name: '--p-saving', start: 0.15, end: 0.75 },
  { name: '--p-history', start: 0.3, end: 0.95 }
]

const hero = ref(null)
let frame = 0
let reduceMotion = null
let current = 0
let target = 0

function readTarget() {
  if (!hero.value || (reduceMotion && reduceMotion.matches)) {
    return 0
  }
  // 0 at the top of the page, 1 once the hero has scrolled away. On a short page that cannot
  // scroll the whole hero, 1 is the bottom of the page instead, so the cards still fully exit.
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  const distance = Math.max(Math.min(hero.value.offsetHeight, maxScroll), 1)
  return Math.min(Math.max(window.scrollY / distance, 0), 1)
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

function applySpread(progress) {
  for (let i = 0; i < exitWindows.length; i++) {
    const w = exitWindows[i]
    const t = Math.min(Math.max((progress - w.start) / (w.end - w.start), 0), 1)
    hero.value.style.setProperty(w.name, smoothstep(t).toFixed(4))
  }
}

// Glide toward the scroll position instead of jumping with it.
function tick() {
  frame = 0
  if (!hero.value) {
    return
  }
  current += (target - current) * 0.12
  if (Math.abs(target - current) < 0.0005) {
    current = target
  }
  applySpread(current)
  if (current !== target) {
    frame = window.requestAnimationFrame(tick)
  }
}

function onScroll() {
  target = readTarget()
  if (!frame) {
    frame = window.requestAnimationFrame(tick)
  }
}

onMounted(function () {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  window.addEventListener('scroll', onScroll, { passive: true })
  target = readTarget()
  current = target
  applySpread(current)
})

onMounted(trendingStore.ensureTrending)

onBeforeUnmount(function () {
  window.removeEventListener('scroll', onScroll)
  if (frame) {
    window.cancelAnimationFrame(frame)
  }
})
</script>

<template>
  <!-- Hero: headline left, analytics cards right. -->
  <div class="fd-landing">
    <section ref="hero" class="fd-hero">
      <div class="container fd-hero-grid">
        <div class="fd-hero-copy">
          <!-- Home header: its own wording, since the tagline already sits in the footer. -->
          <p class="fd-eyebrow">Shop smart, not hard.</p>
          <h1 class="fd-display"><span class="fd-highlight">Smarter</span> buys start here!</h1>
          <p class="fd-hero-text">
            The same item can cost a lot more at one store than another. FastDeal lines up every price, asks our AI if now is a good time to buy, and points you to the cheapest.
          </p>
          <div class="fd-hero-lead">
            <FdSearchBar />
          </div>
        </div>

        <div v-if="comparing || nextSale" class="fd-cluster">
          <article v-if="comparing" class="fd-card fd-card--history">
            <p class="fd-card-label">Comparing pays</p>
            <p class="fd-example-name">{{ comparing.name }}</p>
            <p class="fd-stat">Save {{ money(comparing.gap) }}</p>
            <p class="fd-card-meta">by buying it at the cheapest store instead of the priciest.</p>
            <ul class="fd-bars">
              <li v-for="row in comparing.rows" :key="row.label" class="fd-bar-row">
                <span class="fd-bar-store">{{ row.label }}: {{ row.store }}</span>
                <span class="fd-bar-value">{{ money(row.price) }}</span>
                <span class="fd-bar-track">
                  <span class="fd-bar" :style="{ width: row.width + '%' }"></span>
                </span>
              </li>
            </ul>
          </article>

          <article v-if="nextSale" class="fd-card fd-card--stores">
            <p class="fd-card-label">Next big sale</p>
            <p class="fd-stat">{{ nextSale.id }}</p>
            <p class="fd-card-meta">{{ saleText }}</p>
          </article>

          <!-- Real price drops when there are some; until then, the most-saved products. -->
          <article v-if="drops.length" class="fd-card fd-card--saving">
            <p class="fd-card-label">Price drops right now</p>
            <ul class="fd-drops">
              <li v-for="row in drops" :key="row.name" class="fd-drop-row">
                <span class="fd-drop-item">
                  <span class="fd-drop-name">{{ itemName(row.name) }}</span>
                  <span v-if="row.saved && row.now" class="fd-drop-prices">
                    <s>{{ money(row.saved) }}</s> {{ money(row.now) }}
                  </span>
                </span>
                <span class="fd-drop-percent">-{{ row.percent }}%</span>
              </li>
            </ul>
            <p v-if="moreDrops" class="fd-drops-more">+{{ moreDrops }} more {{ moreDrops === 1 ? 'item' : 'items' }}</p>
            <p class="fd-card-meta">Lower than when shoppers saved them.</p>
          </article>
          <article v-else-if="mostSaved.length" class="fd-card fd-card--saving">
            <p class="fd-card-label">Most saved</p>
            <ul class="fd-drops">
              <li v-for="row in mostSaved" :key="row.name" class="fd-drop-row">
                <span class="fd-drop-item">
                  <span class="fd-drop-name">{{ row.name }}</span>
                </span>
                <span class="fd-drop-percent">{{ row.count }}<small>{{ row.count === 1 ? 'person' : 'people' }}</small></span>
              </li>
            </ul>
            <p class="fd-card-meta">On shoppers' wishlists right now.</p>
          </article>
        </div>
      </div>
    </section>
  </div>

  <!-- Values band: blue, full width; FastDeal's features in a grid, the AI one highlighted. -->
  <section class="fd-values-band" aria-labelledby="fd-values-title">
    <div class="container">
      <h2 id="fd-values-title" class="fd-page-title">Why shop with FastDeal</h2>

      <ul class="fd-values">
        <li v-for="value in values" :key="value.title" class="fd-value">
          <span class="fd-value-icon"><FdIcon :name="value.icon" /></span>
          <div>
            <h3 class="fd-value-title">{{ value.title }}<span v-if="value.ai" class="fd-ai-badge">AI</span></h3>
            <p class="fd-value-text">{{ value.text }}</p>
          </div>
        </li>
      </ul>
    </div>
  </section>

  <!-- Trending today: cream, with the carousel in the container. -->
  <section id="fd-trending" class="fd-trending-section fd-trending-today">
    <div class="container">
      <!-- Early in the day the server sends yesterday's list, so the title says so. -->
      <h2 class="fd-page-title">{{ trendingFrom === 'yesterday' ? 'Trending Yesterday' : 'Trending Today' }}</h2>
      <p v-if="!trendingToday.length" class="fd-trending-empty">Nothing trending yet today.</p>
      <FdBelt v-else :items="trendingToday" label="Trending today">
        <template #default="{ item, tabindex }">
          <router-link :to="{ path: '/compare', query: { q: item.query } }" class="fd-slide" :tabindex="tabindex">
            <img v-img-loading v-if="showImage(item)" :src="item.image" alt="" class="fd-slide-img"
              @error="brokenImages[item.query] = true" />
            <span v-else class="fd-slide-img fd-img-tile" aria-hidden="true">{{ initials(itemName(item.query)) }}</span>
            <span class="fd-slide-name">{{ itemName(item.query) }}</span>
          </router-link>
        </template>
      </FdBelt>
    </div>
  </section>

  <!-- Trending this week: the top 10, one card at a time with an arrow either side. -->
  <section v-if="weekTop.length" class="fd-trending-section fd-trending-week">
    <div class="container">
      <h2 class="fd-page-title">Trending This Week</h2>
      <div
        class="fd-deck-stage"
        role="region"
        aria-roledescription="carousel"
        aria-label="Trending this week"
        tabindex="0"
        @keydown.left.prevent="showWeek(weekActive - 1)"
        @keydown.right.prevent="showWeek(weekActive + 1)"
        @touchstart.passive="onDeckTouchStart"
        @touchend="onDeckTouchEnd"
      >
        <button type="button" class="btn btn-outline-dark fd-deck-arrow" aria-label="Previous product" @click="showWeek(weekActive - 1)">
          <FdIcon name="chevron-left" />
        </button>

        <!-- Below 992px: the front card on a blank stack, one card tilted out on the left (tap for
             the previous product) and two peeking on the right (tap for the next). -->
        <div class="fd-deck">
          <template v-if="weekTop.length > 1">
            <button type="button" class="fd-deck-back is-prev" tabindex="-1" aria-hidden="true" @click="showWeek(weekActive - 1)"></button>
            <span class="fd-deck-back is-next-far" aria-hidden="true"></span>
            <button type="button" class="fd-deck-back is-next" tabindex="-1" aria-hidden="true" @click="showWeek(weekActive + 1)"></button>
          </template>
          <Transition name="fd-deck" mode="out-in">
            <router-link :key="weekItem._id" :to="weekLink(weekItem)" class="fd-deck-card">
              <span class="fd-deck-top">
                <span class="fd-deck-rank">#{{ weekActive + 1 }} this week</span>
                <span class="fd-deck-go" aria-hidden="true"><FdIcon name="chevron-right" /></span>
              </span>
              <span class="fd-deck-name">{{ itemName(weekItem.query) }}</span>
              <span v-if="weekItem.count" class="fd-deck-meta">Searched {{ weekItem.count }} {{ weekItem.count === 1 ? 'time' : 'times' }}</span>
              <img v-img-loading v-if="showImage(weekItem)" :src="weekItem.image" alt="" class="fd-deck-img"
                @error="brokenImages[weekItem.query] = true" />
              <span v-else class="fd-deck-img fd-img-tile" aria-hidden="true">{{ initials(itemName(weekItem.query)) }}</span>
            </router-link>
          </Transition>
        </div>

        <!-- From 992px: the whole top 10 in a row, three in view, gliding one card over. The middle
             card is blue; the others are paper and shrink back a little. -->
        <div class="fd-reel">
          <div class="fd-reel-track">
            <a
              v-for="(item, index) in weekTop"
              :key="item._id"
              :href="router.resolve(weekLink(item)).href"
              class="fd-deck-card fd-reel-card"
              :class="{ 'is-active': index === weekActive, 'is-far': Math.abs(reelOffset(index)) > 2 }"
              :style="{ '--d': reelOffset(index) }"
              :tabindex="index === weekActive ? 0 : -1"
              :aria-hidden="index !== weekActive"
              @click.prevent="openReel(index)"
            >
              <span class="fd-deck-top">
                <span class="fd-deck-rank">#{{ index + 1 }} this week</span>
                <span class="fd-deck-go" aria-hidden="true"><FdIcon name="chevron-right" /></span>
              </span>
              <span class="fd-deck-name">{{ itemName(item.query) }}</span>
              <span v-if="item.count" class="fd-deck-meta">Searched {{ item.count }} {{ item.count === 1 ? 'time' : 'times' }}</span>
              <img v-img-loading v-if="showImage(item)" :src="item.image" alt="" class="fd-deck-img"
                @error="brokenImages[item.query] = true" />
              <span v-else class="fd-deck-img fd-img-tile" aria-hidden="true">{{ initials(itemName(item.query)) }}</span>
            </a>
          </div>
        </div>

        <span class="visually-hidden" aria-live="polite">{{ weekActive + 1 }} of {{ weekTop.length }}</span>
        <button type="button" class="btn btn-outline-dark fd-deck-arrow" aria-label="Next product" @click="showWeek(weekActive + 1)">
          <FdIcon name="chevron-right" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Blue band behind Trending Today; the white carousel card sits on it. */
/* Both trending sections share the same padding and title gap. */
.fd-trending-section {
  padding: 3rem 0;
}

.fd-trending-section .fd-page-title {
  margin-bottom: 2rem;
}

.fd-trending-empty {
  margin: 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-page-subtitle);
}

/* Trending This Week card: blue with beige text, like the values band, with a round 48px
   arrow either side, centred on the card's height. */
.fd-deck-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
}

@media (min-width: 768px) {
  .fd-deck-stage {
    gap: 2.5rem;
  }
}

.fd-deck {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 22rem;
  border-radius: 1.25rem;
  touch-action: pan-y;
}

.fd-deck-stage:focus-visible {
  outline: 3px solid var(--fd-vanilla);
  outline-offset: 6px;
  border-radius: 1.25rem;
}

.fd-deck-card {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  padding: 1rem 1.5rem 1.25rem;
  border: var(--fd-border) solid var(--fd-blue);
  border-radius: 1.25rem;
  background: var(--fd-blue);
  /* The one card here with a shadow, so the front card lifts off the stack behind it. */
  box-shadow: var(--fd-shadow);
  color: var(--fd-beige);
  text-decoration: none;
  transition: border-color 0.2s ease;
}

.fd-deck-card:hover {
  border-color: var(--fd-vanilla);
}

.fd-deck-card:focus-visible {
  outline: 3px solid var(--fd-vanilla);
  outline-offset: 3px;
}

/* Paper cards behind the front one, like a stack: they keep still while the front card changes. */
.fd-deck-back {
  position: absolute;
  inset: 0;
  padding: 0;
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: 1.25rem;
  background: var(--fd-paper);
}

.fd-deck-back.is-prev {
  z-index: 2;
  transform: translate(-9%, 1.25rem) rotate(-5deg) scale(0.92);
}

.fd-deck-back.is-next {
  z-index: 2;
  transform: translate(5%, 0.5rem) rotate(2deg) scale(0.96);
}

.fd-deck-back.is-next-far {
  z-index: 1;
  transform: translate(9%, 1rem) rotate(4deg) scale(0.92);
}

button.fd-deck-back:hover {
  border-color: var(--fd-blue);
}

/* The row of cards is for wide screens only. */
.fd-reel {
  display: none;
}

/* Wide screens: the whole top 10 in a row, three in view, that glides one card over like a scroll.
   The middle card is the blue one; as it moves the others shrink back to paper. */
@media (min-width: 992px) {
  .fd-deck {
    display: none;
  }

  /* Cards stay 17rem wide, the same as before; on the narrowest of these screens the arrows sit
     right against the row, beside the side cards' 10% inset, so all three still fit. */
  .fd-deck-stage {
    gap: 0;
  }

  .fd-reel {
    --reel-card: 17rem;
    --reel-gap: 0.75rem;
    display: block;
    width: calc(3 * var(--reel-card) + 2 * var(--reel-gap));
    overflow: hidden;
    /* Room for the middle card's shadow, which the clip would otherwise cut off. */
    padding: 0.5rem 0 2rem;
  }

  /* Every card sits in the same grid cell, moved sideways by its distance from the middle (--d),
     so the row is as tall as its tallest card and loops round. */
  .fd-reel-track {
    display: grid;
    justify-content: center;
  }

  .fd-reel-card {
    grid-area: 1 / 1;
    width: var(--reel-card);
    border-color: var(--fd-vanilla-line);
    background: var(--fd-paper);
    box-shadow: none;
    cursor: pointer;
    transform: translateX(calc(var(--d) * (var(--reel-card) + var(--reel-gap)))) scale(0.9);
    transition: transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1), background-color 0.4s ease,
      border-color 0.4s ease, box-shadow 0.4s ease;
  }

  /* Cards well out of view jump instead of gliding, so one wrapping round the loop never crosses the row. */
  .fd-reel-card.is-far {
    visibility: hidden;
    transition: none;
  }

  .fd-reel-card:hover {
    border-color: var(--fd-blue);
  }

  .fd-reel-card.is-active {
    border-color: var(--fd-blue);
    background: var(--fd-blue);
    box-shadow: var(--fd-shadow);
    transform: translateX(0);
  }

  .fd-reel-card.is-active:hover {
    border-color: var(--fd-vanilla);
  }

  /* Paper cards: blue label and title, muted count, fading to the blue card's colours. */
  .fd-reel-card .fd-deck-rank,
  .fd-reel-card .fd-deck-name,
  .fd-reel-card .fd-deck-meta {
    transition: color 0.4s ease;
  }

  .fd-reel-card:not(.is-active) .fd-deck-rank,
  .fd-reel-card:not(.is-active) .fd-deck-name {
    color: var(--fd-blue);
  }

  .fd-reel-card:not(.is-active) .fd-deck-meta {
    color: var(--fd-text-muted);
  }

  /* The narrower cards wrap names sooner, so they keep three lines, still the same on every card. */
  .fd-reel .fd-deck-name {
    min-height: 3.45em;
    -webkit-line-clamp: 3;
  }
}

@media (min-width: 1200px) {
  .fd-deck-stage {
    gap: 1.5rem;
  }

  .fd-reel {
    --reel-gap: 1rem;
  }
}

/* The arrows sit above the edges of the stack. */
.fd-deck-arrow {
  position: relative;
  z-index: 4;
}

/* Switching cards: the old one slides out left and fades, the new one slides in from the right. */
.fd-deck-enter-active,
.fd-deck-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.fd-deck-enter-from {
  opacity: 0;
  transform: translateX(1.5rem);
}

.fd-deck-leave-to {
  opacity: 0;
  transform: translateX(-1.5rem);
}

.fd-deck-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

/* Eyebrow type (see .fd-eyebrow), in beige like all text on blue. */
.fd-deck-rank {
  color: var(--fd-beige);
  font-size: var(--fd-eyebrow);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.fd-deck-go {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--fd-control-sm);
  height: var(--fd-control-sm);
  border-radius: 50%;
  background: var(--fd-vanilla);
  color: var(--fd-blue);
}

/* Same type as the values band titles (.fd-value-title). Always two lines tall, so every card is the same height
   and the arrows beside it stay put. */
.fd-deck-name {
  display: -webkit-box;
  overflow: hidden;
  min-height: 2.3em;
  margin-bottom: 0.25rem;
  color: var(--fd-beige);
  font-family: var(--fd-font-display);
  font-size: var(--fd-section-title);
  font-weight: 400;
  letter-spacing: 0.02em;
  line-height: 1.15;
  text-transform: uppercase;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* Same as the values band text (.fd-value-text). */
.fd-deck-meta {
  margin: 0;
  color: color-mix(in srgb, var(--fd-beige) 85%, transparent);
  font-size: var(--fd-body);
}

/* Square white photo tile at the bottom of the card, like the other product photos. */
.fd-deck-img {
  width: 100%;
  aspect-ratio: 1;
  margin-top: 0.75rem;
  padding: 1.25rem;
  border-radius: 1rem;
  background: var(--fd-white);
  object-fit: contain;
}

.fd-deck-arrow {
  flex-shrink: 0;
  width: var(--fd-control);
  height: var(--fd-control);
  padding: 0;
  border-radius: 50%;
}

@media (prefers-reduced-motion: reduce) {
  .fd-deck-enter-active,
  .fd-deck-leave-active,
  .fd-reel-track,
  .fd-reel-card {
    transition: none;
  }
}

/* Each Trending Today card: white photo area, then the name. The whole card is the link. */
.fd-slide {
  display: flex;
  flex-direction: column;
  padding: var(--fd-card-pad);
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: 1rem;
  background: var(--fd-paper);
  color: var(--fd-text);
  text-decoration: none;
  transition: border-color 0.2s ease;
}

/* Hover highlights the slide with a blue outline. It never grows. */
.fd-slide:hover,
.fd-slide:focus-visible {
  border-color: var(--fd-blue);
}

.fd-slide:focus-visible {
  outline: 3px solid var(--fd-vanilla);
  outline-offset: 3px;
}

/* Photo and name sized like the Trending This Week cards. */
.fd-slide-img {
  width: 100%;
  height: 170px;
  margin-bottom: 1.25rem;
  padding: 1.25rem;
  border-radius: 0.75rem;
  /* White behind the photo, matching the photo's own white background. */
  background: var(--fd-white);
  object-fit: contain;
}

/* No photo: the product's initials on the same white tile, like the wishlist. */
.fd-img-tile {
  display: grid;
  place-items: center;
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  font-size: var(--fd-page-title);
  line-height: 1;
}

.fd-slide-name {
  color: var(--fd-text);
  font-size: var(--fd-body);
  font-weight: 600;
  line-height: 1.3;
}



/* Trending This Week follows straight on, so only one section's padding sits between them. */
.fd-trending-section + .fd-trending-section {
  padding-top: 0;
}

/* A short gap from the carousel dots down to Trending This Week, then more room before the footer. */
.fd-trending-today {
  padding-bottom: 1.5rem;
}

.fd-trending-week {
  padding-bottom: 5rem;
}

/* Values band: blue, centred title, then a feature grid. */
.fd-values-band {
  padding: 4rem 0;
  background: var(--fd-blue);
  color: var(--fd-beige);
}

.fd-values-band .fd-page-title {
  margin-bottom: 2rem;
  color: var(--fd-beige);
  text-align: center;
}

/* Feature grid: icon tile beside a title and one short line. */
.fd-values {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* One column of four on phones and small tablets; two by two from 768px. */
@media (min-width: 768px) {
  .fd-values {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* One row of four on wide screens; the icon sits above the text there. */
@media (min-width: 1200px) {
  .fd-values {
    grid-template-columns: repeat(4, 1fr);
  }

  .fd-values .fd-value {
    flex-direction: column;
    padding: 1.5rem;
    text-align: center;
  }
}

.fd-value {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid transparent;
  border-radius: 1.25rem;
  background: transparent;
}

.fd-value-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--fd-beige) 12%, transparent);
  color: var(--fd-vanilla);
}

.fd-value-icon .fd-icon {
  width: 1.75rem;
  height: 1.75rem;
  stroke-width: 1.5;
}

/* Same size as "The team" heading in the footer: the section title size. */
.fd-value-title {
  margin-bottom: 0.25rem;
  color: var(--fd-beige);
  font-family: var(--fd-font-display);
  font-size: var(--fd-section-title);
  font-weight: 400;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}


/* Small AI tag beside the photo search title. */
.fd-ai-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  background: var(--fd-vanilla);
  color: var(--fd-ink);
  font-family: var(--fd-font-body);
  font-size: var(--fd-small);
  font-weight: 700;
  letter-spacing: 0.04em;
  vertical-align: middle;
}

/* Same size as the hero paragraph: both are body size. */
.fd-value-text {
  margin: 0;
  color: color-mix(in srgb, var(--fd-beige) 85%, transparent);
  font-size: var(--fd-body);
}

.fd-landing {
  overflow-x: clip;
}

/* Hero: editorial split, copy left, analytics cluster right */

.fd-hero {
  --p-stores: 0;
  --p-saving: 0;
  --p-history: 0;
  /* About three quarters of the screen, used as the Home page header. */
  display: flex;
  align-items: center;
  min-height: 75svh;
  padding: 2.5rem 0;
}

.fd-hero > .container {
  width: 100%;
}

.fd-hero-grid {
  display: grid;
  gap: 3rem;
  align-items: center;
}

@media (min-width: 1200px) {
  .fd-hero-grid {
    grid-template-columns: 5fr 6fr;
  }
}

/* Stacked: the headline and description, then the search bar, then the cards. */
@media (max-width: 1199.98px) {
  .fd-hero-grid {
    gap: 0;
  }

  .fd-hero-copy {
    display: contents;
  }

  .fd-hero-lead {
    order: 1;
  }

  .fd-cluster {
    order: 2;
    margin-top: 2rem;
  }
}

.fd-display {
  margin-bottom: 1.25rem;
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  /* Phones: 4rem, so the headline still fills the narrow screen; grows with the window up to 5.25rem. */
  font-size: clamp(4rem, 7vw, 5.25rem);
  font-weight: 400;
  line-height: 0.92;
  text-transform: uppercase;
  text-wrap: balance;
}

.fd-highlight {
  position: relative;
  z-index: 0;
  display: inline-block;
  line-height: inherit;
}

/* Stripe centred behind the caps. Sized in em so it scales with the headline. */
.fd-highlight::before {
  content: '';
  position: absolute;
  z-index: -1;
  left: 0;
  right: 0;
  /* Anton caps run from about 0.04em to 0.9em above the bottom of this box,
     so a 0.44em stripe starting at 0.245em sits centred on them. */
  bottom: 0.245em;
  height: 0.44em;
  background: var(--fd-vanilla);
}

/* The hero eyebrow is ink, unlike the blue eyebrows elsewhere. */
.fd-hero-copy .fd-eyebrow {
  color: var(--fd-text);
}

/* Same size as the team member names in the footer: body size. */
.fd-hero-text {
  max-width: 32rem;
  margin-bottom: 2rem;
  color: var(--fd-text-muted);
  font-size: var(--fd-body);
  line-height: 1.6;
}

/* Analytics cards */

.fd-cluster {
  position: relative;
  display: grid;
  gap: 1rem;
}

.fd-card {
  padding: var(--fd-card-pad);
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: 1.25rem;
  background: var(--fd-paper);
  will-change: transform;
}

/* Scroll spread: all three fan out to the right, away from the headline, each on its own timing. 110vw guarantees they clear the screen. */
.fd-card--history {
  transform: translate(calc(110vw * var(--p-history)), calc(1rem * var(--p-history))) rotate(calc(4deg * var(--p-history)));
}

.fd-card--stores {
  transform: translate(calc(110vw * var(--p-stores)), calc(-8rem * var(--p-stores))) rotate(calc(-10deg * var(--p-stores)));
}

.fd-card--saving {
  transform: translate(calc(110vw * var(--p-saving)), calc(8rem * var(--p-saving))) rotate(calc(12deg * var(--p-saving)));
}

@media (min-width: 768px) and (max-width: 1199.98px) {
  .fd-cluster {
    grid-template-columns: 3fr 2fr;
    align-items: start;
  }

  /* Centred down the height of the two cards beside it, like the wide layout. */
  .fd-card--history {
    grid-row: span 2;
    align-self: center;
  }
}

@media (min-width: 1200px) {
  /* The graph takes 59% and stays the big card; the other two stack beside it with a 1rem gap,
     in the grid rather than pinned, so longer text pushes them apart instead of overlapping. */
  .fd-cluster {
    grid-template-columns: 59% 1fr;
    align-items: start;
  }

  /* Centred down the height of the two cards beside it. */
  .fd-card--history {
    grid-row: span 2;
    align-self: center;
  }
}

/* Stacked layouts keep the cards in place; only the wide layout flies them out. */
@media (max-width: 1199.98px), (prefers-reduced-motion: reduce) {
  .fd-card--history,
  .fd-card--saving,
  .fd-card--stores {
    transform: none;
  }
}

.fd-card-label {
  margin-bottom: 0.25rem;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.fd-card-value {
  margin-bottom: 0.125rem;
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  /* Anton level 3: section title size. */
  font-size: var(--fd-section-title);
  line-height: 1.1;
}

.fd-card-note {
  color: var(--fd-text-muted);
  font-family: var(--fd-font-body);
  font-size: var(--fd-small);
}

.fd-card-meta {
  margin-bottom: 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
}

/* Saving stat */

.fd-stat {
  margin-bottom: 0.25rem;
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  /* Anton level 2: page title size. */
  font-size: var(--fd-page-title);
  line-height: 1;
}

/* Overpay bars: store name and amount on one line, a full-width bar under them. */

.fd-bars {
  display: grid;
  gap: 0.625rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}

.fd-bar-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.25rem 0.75rem;
  align-items: center;
  font-size: var(--fd-small);
}

.fd-bar-store {
  min-width: 0;
  color: var(--fd-text);
  line-height: 1.3;
}

.fd-bar-value {
  color: var(--fd-text);
  font-weight: 700;
}

/* The product name above "Save S$...", like the label of the other cards. */
.fd-example-name {
  margin: 0.25rem 0 0;
  color: var(--fd-text);
  font-size: var(--fd-small);
  font-weight: 700;
}

/* Price drops: the product and its prices on the left, the drop big on the right in Anton,
   like the "Save S$..." stat on the card beside it. */
.fd-drops {
  display: grid;
  margin: 0.5rem 0 0.75rem;
  padding: 0;
  list-style: none;
}

.fd-drop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.fd-drop-row + .fd-drop-row {
  border-top: 1px solid var(--fd-vanilla-line);
}

.fd-drop-item {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.fd-drop-name {
  color: var(--fd-text);
  font-weight: 700;
  line-height: 1.3;
}

.fd-drop-prices {
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
}

.fd-drop-percent {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-end;
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  font-size: var(--fd-section-title);
  line-height: 1.1;
}

.fd-drop-percent small {
  color: var(--fd-text-muted);
  font-family: var(--fd-font-body);
  font-size: var(--fd-small);
}

.fd-drops-more {
  margin: -0.25rem 0 0.75rem;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
}

.fd-bar-track {
  grid-column: 1 / -1;
  height: 8px;
  border-radius: 999px;
  background: var(--fd-beige);
}

.fd-bar {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--fd-blue);
}
</style>
