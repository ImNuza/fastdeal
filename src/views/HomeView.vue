<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import FdSearchBar from '../components/FdSearchBar.vue'
import FdIcon from '../components/FdIcon.vue'
import { itemName } from '../services/itemName.js'
import axios from 'axios'
import { storeToRefs } from 'pinia'
import { useTrendingStore } from '../store/trending.js'

// The values band under the hero: FastDeal's features in four groups. ai marks the AI-powered one.
const values = [
  { icon: 'sparkles', title: 'Photo search', text: 'Snap it, AI finds it.', ai: true },
  { icon: 'scale', title: 'Compare', text: 'Every store, 14-day history, deal check.' },
  { icon: 'wallet', title: 'Plan', text: 'Wishlist and budget planner.' },
  { icon: 'moon', title: 'Decide', text: 'Sleep on it, or buy with friends.' }
]

// Trending lists come from the trending store, shared with the Trending page and the search bar.
const trendingStore = useTrendingStore()
const { topToday: trendingToday, weekExtras: trendingWeek } = storeToRefs(trendingStore)

// Trending Today belt: the cards roll past nonstop, like a conveyor belt. One pass repeats
// the items until it holds at least BELT_MIN cards (so a short list still fills the screen),
// and the pass is drawn twice; the animation moves exactly one pass, so it loops seamlessly.
// It pauses on hover, focus, or touch, and never moves for anyone who asked for reduced motion.
const BELT_MIN = 8
const BELT_SECONDS_PER_CARD = 5

const beltPass = computed(function () {
  const items = trendingToday.value
  if (!items.length) {
    return []
  }
  let pass = []
  while (pass.length < BELT_MIN) {
    pass = pass.concat(items)
  }
  return pass
})

const beltSeconds = computed(function () {
  return beltPass.value.length * BELT_SECONDS_PER_CARD
})

// Touch has no hover, so a finger on the belt holds it still until it lifts.
const beltHeld = ref(false)

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
  return (stats.value && stats.value.drops) || []
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
            The same item can cost a lot more at one store than another. FastDeal lines up every price, shows how it moved over 14 days, and points you to the cheapest.
          </p>
          <FdSearchBar />
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
      <h2 class="fd-page-title">Trending Today</h2>
      <p v-if="!trendingToday.length" class="fd-trending-empty">Nothing trending yet today.</p>
      <div
        v-else
        class="fd-belt"
        :class="{ 'is-held': beltHeld }"
        aria-label="Trending today"
        @touchstart.passive="beltHeld = true"
        @touchend="beltHeld = false"
        @touchcancel="beltHeld = false"
      >
        <div class="fd-belt-track" :style="{ '--belt-seconds': beltSeconds + 's' }">
          <template v-for="copy in 2" :key="'pass-' + copy">
            <router-link
              v-for="(item, index) in beltPass"
              :key="copy + '-' + index"
              :to="{ path: '/compare', query: { q: item.query } }"
              class="fd-slide"
              :tabindex="copy === 1 && index < trendingToday.length ? 0 : -1"
              :aria-hidden="copy === 2 || index >= trendingToday.length"
            >
              <img :src="item.image" alt="" class="fd-slide-img" />
              <span class="fd-slide-name">{{ itemName(item.query) }}</span>
            </router-link>
          </template>
        </div>
      </div>
    </div>
  </section>

  <!-- Trending this week: stays on the cream page background. -->
  <section class="fd-trending-section fd-trending-week">
    <div class="container">
      <h2 class="fd-page-title">Trending This Week</h2>
      <div class="row g-3">
        <div class="col-6 col-md-4 col-lg-3" v-for="item in trendingWeek" :key="item._id">
          <router-link class="fd-week-link" :to="{ path: '/compare', query: { q: item.query } }" style="text-decoration: none;">
            <div class="card h-100 fd-week-card" style="padding: 1.25rem; border-radius: 1rem;">
              <img :src="item.image"  class="card-img-top" style="display: block; width: 100%; height: 170px; padding: 1.25rem; object-fit: contain; border-radius: 0.75rem; background: var(--fd-white); margin-bottom: 1.25rem;">
              <h5 class="card-title" style="margin: 0; font-size: var(--fd-body); font-weight: 600; line-height: 1.3;">{{ itemName(item.query) }}</h5>
            </div>
          </router-link>
        </div>
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

/* Trending Today belt: one long row of cards that rolls left nonstop. The track holds the pass
   twice, so moving it by half its width lands on an identical frame and the loop never jumps. */
/* Card width matches the Trending This Week grid (two, three, then four across), worked out
   from the belt's own width with container units, plus the same 1rem gap. */
.fd-belt {
  --gap: 1rem;
  --card: calc((100cqw - var(--gap)) / 2);
  container-type: inline-size;
  overflow: hidden;
  padding: 0.5rem 0 1rem;
}

@media (min-width: 768px) {
  .fd-belt {
    --card: calc((100cqw - 2 * var(--gap)) / 3);
  }
}

@media (min-width: 992px) {
  .fd-belt {
    --card: calc((100cqw - 3 * var(--gap)) / 4);
  }
}

.fd-belt-track {
  display: flex;
  gap: var(--gap);
  width: max-content;
  animation: fd-belt-roll var(--belt-seconds) linear infinite;
}

/* Hover, keyboard focus, or a finger on it holds the belt still so a card can be read and tapped. */
.fd-belt:hover .fd-belt-track,
.fd-belt:focus-within .fd-belt-track,
.fd-belt.is-held .fd-belt-track {
  animation-play-state: paused;
}

@keyframes fd-belt-roll {
  from {
    transform: translateX(0);
  }
  to {
    /* Half the track plus half a gap: exactly one pass, including the gap after its last card. */
    transform: translateX(calc(-50% - var(--gap) / 2));
  }
}

/* Reduced motion: no rolling; the row scrolls sideways by hand instead. */
@media (prefers-reduced-motion: reduce) {
  .fd-belt {
    overflow-x: auto;
  }

  .fd-belt-track {
    animation: none;
  }
}

/* Each card matches a Trending This Week card: white photo area, then the name. The whole card is the link. */
.fd-slide {
  display: flex;
  flex: 0 0 var(--card);
  flex-direction: column;
  padding: 1.25rem;
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: 1rem;
  background: var(--fd-paper);
  color: var(--fd-text);
  text-decoration: none;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.fd-slide:hover,
.fd-slide:focus-visible {
  border-color: var(--fd-blue);
  transform: scale(1.03);
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

.fd-slide-name {
  color: var(--fd-text);
  font-size: var(--fd-body);
  font-weight: 600;
  line-height: 1.3;
}

@media (prefers-reduced-motion: reduce) {
  .fd-slide {
    transition: none;
  }

  .fd-slide:hover,
  .fd-slide:focus-visible {
    transform: none;
  }
}

/* Trending This Week cards: hovering (or tabbing to) one gives it a blue outline and lifts it a little. */
.fd-week-link {
  display: block;
  height: 100%;
  border-radius: 1rem;
}

.fd-week-card {
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.fd-week-link:hover .fd-week-card,
.fd-week-link:focus-visible .fd-week-card {
  border-color: var(--fd-blue);
  transform: scale(1.03);
}

.fd-week-link:focus-visible {
  outline: 3px solid var(--fd-vanilla);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .fd-week-card {
    transition: none;
  }

  .fd-week-link:hover .fd-week-card,
  .fd-week-link:focus-visible .fd-week-card {
    transform: none;
  }
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

@media (min-width: 576px) {
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
  transition: border-color 0.2s ease, background-color 0.2s ease;
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

/* Hovering a card lights it up with a vanilla outline. */
.fd-value:hover {
  border-color: var(--fd-vanilla);
  background: color-mix(in srgb, var(--fd-paper) 10%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .fd-value {
    transition: none;
  }
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

.fd-display {
  margin-bottom: 1.25rem;
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  font-size: clamp(3rem, 7vw, 5.25rem);
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
  padding: 1.25rem;
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

  .fd-card--history {
    grid-row: span 2;
  }
}

@media (min-width: 1200px) {
  .fd-cluster {
    display: block;
    min-height: 36rem;
  }

  .fd-card {
    position: absolute;
  }

  .fd-card--history {
    top: 6rem;
    left: 0;
    width: 59%;
    z-index: 1;
  }

  /* Narrower than the space beside the graph, leaving a 1rem gap so the two never overlap
     (the graph keeps its 59% and stays the big card). */
  .fd-card--stores {
    top: 0;
    right: 0;
    width: calc(41% - 1rem);
    z-index: 2;
  }

  /* Same width as the card above it, so it sits the same 1rem from the graph. */
  .fd-card--saving {
    bottom: 0;
    right: 0;
    width: calc(41% - 1rem);
    z-index: 3;
  }
}

@media (prefers-reduced-motion: reduce) {
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
