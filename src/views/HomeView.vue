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

// The hero cards all come from live data (/api/home-stats): what real people searched this
// week and the store prices the shopping API returned for it. Nothing is seeded. Until it
// loads, or when there is nothing yet, the cards stay hidden.
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

// The top trending product, for all three cards.
const heroProduct = computed(function () {
  const product = stats.value && stats.value.product
  if (!product || product.stores.length < 2) {
    return null
  }
  const stores = product.stores
  const cheapest = stores[0]
  const priciest = stores[stores.length - 1]
  const saving = priciest.price - cheapest.price
  return {
    name: itemName(product.name),
    stores: stores,
    cheapest: cheapest,
    priciest: priciest,
    saving: saving,
    // Up to four bars: the three cheapest stores and the priciest, so the last bar matches "You save".
    overpay: (stores.length > 4 ? stores.slice(0, 3).concat([priciest]) : stores).map(function (item) {
      return {
        store: item.store,
        extra: item.price - cheapest.price,
        width: saving ? ((item.price - cheapest.price) / saving) * 100 : 0
      }
    })
  }
})

// "YYYY-MM-DD" in Singapore time, like the server's price days.
function sgDay(time) {
  return new Date(time + 8 * 3600000).toISOString().slice(0, 10)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayName(day) {
  if (day === sgDay(Date.now())) {
    return 'Today'
  }
  return Number(day.slice(8, 10)) + ' ' + MONTHS[Number(day.slice(5, 7)) - 1]
}

// Price tracking: the lowest price on each tracked day, once there are at least two days.
// Until then the graph shows today's price at every store, cheapest to priciest.
const tracking = computed(function () {
  const history = (stats.value && stats.value.product && stats.value.product.history) || []
  if (history.length < 2) {
    return null
  }
  const first = history[0]
  const last = history[history.length - 1]
  return {
    history: history,
    today: last.price,
    change: last.price - first.price,
    since: dayName(first.day)
  }
})

// Graph series: either the tracked days or today's stores. Both are a list of
// { label, price }, so one line chart draws either.
const series = computed(function () {
  if (tracking.value) {
    return tracking.value.history.map(function (d) { return { label: dayName(d.day), price: d.price } })
  }
  if (heroProduct.value) {
    return heroProduct.value.stores.map(function (item) { return { label: item.store, price: item.price } })
  }
  return []
})

// Price graph (SVG units).
const chart = { width: 320, height: 150, top: 16, right: 12, bottom: 24, left: 12 }

const graph = computed(function () {
  const rows = series.value
  if (rows.length < 2) {
    return null
  }
  const prices = rows.map(function (row) { return row.price })
  const low = Math.min.apply(null, prices)
  const high = Math.max.apply(null, prices)
  const average = prices.reduce(function (sum, n) { return sum + n }, 0) / prices.length
  const pad = (high - low) * 0.1 || high * 0.05 || 1
  const yMin = low - pad
  const yMax = high + pad
  const plot = chart.height - chart.top - chart.bottom
  const points = prices.map(function (price, i) {
    return {
      x: chart.left + (i * (chart.width - chart.left - chart.right)) / (prices.length - 1),
      y: chart.top + ((yMax - price) * plot) / (yMax - yMin)
    }
  })
  const line = points.map(function (pt, i) {
    return (i === 0 ? 'M' : 'L') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1)
  }).join(' ')
  const lastPoint = points[points.length - 1]
  const lowIndex = prices.indexOf(low)
  const name = heroProduct.value.name
  return {
    points: points,
    line: line,
    area: line + ' L' + lastPoint.x.toFixed(1) + ' ' + (chart.height - chart.bottom) +
      ' L' + points[0].x.toFixed(1) + ' ' + (chart.height - chart.bottom) + ' Z',
    average: average,
    averageY: chart.top + ((yMax - average) * plot) / (yMax - yMin),
    lowPoint: points[lowIndex],
    firstLabel: tracking.value ? rows[0].label : 'Cheapest store',
    lastLabel: tracking.value ? rows[rows.length - 1].label : 'Priciest',
    summary: tracking.value
      ? 'Lowest price of ' + name + ' each day from ' + rows[0].label + ' to ' + rows[rows.length - 1].label +
        ', from ' + money(prices[0]) + ' to ' + money(prices[prices.length - 1]) + '. Lowest ' + money(low) + '.'
      : 'Price of ' + name + ' at ' + prices.length + ' stores today, from ' + money(low) + ' to ' + money(high) + '.'
  }
})

const hoverIndex = ref(null)
const chartBox = ref(null)

function onChartPointer(event) {
  const count = series.value.length
  const box = chartBox.value.getBoundingClientRect()
  const svgX = ((event.clientX - box.left) / box.width) * chart.width
  const step = (chart.width - chart.left - chart.right) / (count - 1)
  const index = Math.round((svgX - chart.left) / step)
  hoverIndex.value = Math.min(Math.max(index, 0), count - 1)
}

function clearChartPointer() {
  hoverIndex.value = null
}

const tooltip = computed(function () {
  if (hoverIndex.value === null || !graph.value) {
    return null
  }
  const pt = graph.value.points[hoverIndex.value]
  const row = series.value[hoverIndex.value]
  return { left: (pt.x / chart.width) * 100 + '%', x: pt.x, y: pt.y, label: row.label, price: money(row.price) }
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

        <div v-if="heroProduct && graph" class="fd-cluster">
          <article class="fd-card fd-card--history">
            <header class="fd-card-head">
              <p class="fd-card-label">{{ heroProduct.name }}</p>
              <template v-if="tracking">
                <p class="fd-card-value">{{ money(tracking.today) }} <span class="fd-card-note">today</span></p>
                <p class="fd-card-meta">
                  <template v-if="tracking.change < 0">Down {{ money(-tracking.change) }} since {{ tracking.since }}</template>
                  <template v-else-if="tracking.change > 0">Up {{ money(tracking.change) }} since {{ tracking.since }}</template>
                  <template v-else>No change since {{ tracking.since }}</template>
                  · lowest price each day
                </p>
              </template>
              <template v-else>
                <p class="fd-card-value">{{ money(heroProduct.cheapest.price) }} <span class="fd-card-note">cheapest today</span></p>
                <p class="fd-card-meta">Price tracking just started: the daily line appears once there are 2 days. For now, {{ heroProduct.stores.length }} stores today.</p>
              </template>
            </header>
            <div
              ref="chartBox"
              class="fd-chart"
              @pointermove="onChartPointer"
              @pointerdown="onChartPointer"
              @pointerleave="clearChartPointer"
            >
              <svg :viewBox="'0 0 ' + chart.width + ' ' + chart.height" role="img" :aria-label="graph.summary">
                <path class="fd-chart-area" :d="graph.area" />
                <line class="fd-chart-average" :x1="chart.left" :x2="chart.width - chart.right" :y1="graph.averageY" :y2="graph.averageY" />
                <path class="fd-chart-line" :d="graph.line" />
                <circle class="fd-chart-low" :cx="graph.lowPoint.x" :cy="graph.lowPoint.y" r="5" />
                <g v-if="tooltip">
                  <line class="fd-chart-cross" :x1="tooltip.x" :x2="tooltip.x" :y1="chart.top" :y2="chart.height - chart.bottom" />
                  <circle class="fd-chart-hover" :cx="tooltip.x" :cy="tooltip.y" r="5" />
                </g>
                <text class="fd-chart-value" :x="graph.points[0].x" :y="graph.points[0].y - 10">{{ money(series[0].price) }}</text>
                <text class="fd-chart-value" :x="graph.points[graph.points.length - 1].x" :y="graph.points[graph.points.length - 1].y - 10" text-anchor="end">{{ money(series[series.length - 1].price) }}</text>
                <text class="fd-chart-axis" :x="chart.left" :y="chart.height - 6">{{ graph.firstLabel }}</text>
                <text class="fd-chart-axis" :x="chart.width - chart.right" :y="chart.height - 6" text-anchor="end">{{ graph.lastLabel }}</text>
              </svg>
              <div v-if="tooltip" class="fd-tooltip" :style="{ left: tooltip.left }" aria-hidden="true">
                <span>{{ tooltip.label }}</span>
                <strong>{{ tooltip.price }}</strong>
              </div>
            </div>
            <p class="fd-chart-key">
              <span class="fd-key fd-key--low"></span>{{ tracking ? 'Lowest' : 'Cheapest' }}
              <span class="fd-key fd-key--avg"></span>Average
            </p>
          </article>

          <article class="fd-card fd-card--saving">
            <p class="fd-card-label">You save</p>
            <p class="fd-stat">{{ money(heroProduct.saving) }}</p>
            <p class="fd-card-meta">Buy at <strong class="fd-save-store">{{ heroProduct.cheapest.store }}</strong> instead of the priciest store.</p>
          </article>

          <article class="fd-card fd-card--stores">
            <p class="fd-card-label">Extra you'd pay vs cheapest</p>
            <ul class="fd-bars">
              <li v-for="row in heroProduct.overpay" :key="row.store" class="fd-bar-row">
                <span class="fd-bar-store">{{ row.store }}</span>
                <span v-if="row.extra" class="fd-bar-value">+{{ money(row.extra) }}</span>
                <span v-else class="fd-bar-cheapest">Cheapest</span>
                <span class="fd-bar-track">
                  <span v-if="row.extra" class="fd-bar" :style="{ width: row.width + '%' }"></span>
                </span>
              </li>
            </ul>
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

/* Price graph */

.fd-chart {
  position: relative;
  margin-top: 0.75rem;
  touch-action: pan-y;
  cursor: crosshair;
}

.fd-chart svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.fd-chart-area {
  fill: var(--fd-vanilla-soft);
}

.fd-chart-line {
  fill: none;
  stroke: var(--fd-blue);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.fd-chart-average {
  stroke: var(--fd-text-muted);
  stroke-width: 1;
  stroke-dasharray: 4 4;
  opacity: 0.6;
}

.fd-chart-low,
.fd-chart-hover {
  stroke: var(--fd-paper);
  stroke-width: 2;
}

/* The lowest point: vanilla with a blue ring, so it stands out on the blue line. */
.fd-chart-low {
  fill: var(--fd-vanilla);
  stroke: var(--fd-blue);
}

.fd-chart-hover {
  fill: var(--fd-blue);
}

.fd-chart-cross {
  stroke: var(--fd-text-muted);
  stroke-width: 1;
  opacity: 0.5;
}

.fd-chart-axis {
  fill: var(--fd-text-muted);
  font-family: var(--fd-font-body);
  font-size: var(--fd-small);
}

/* The first and last price, written on the line so the graph reads without hovering. */
.fd-chart-value {
  fill: var(--fd-blue);
  font-family: var(--fd-font-body);
  font-size: var(--fd-small);
  font-weight: 700;
}

.fd-tooltip {
  position: absolute;
  top: -0.5rem;
  transform: translate(-50%, -100%);
  display: grid;
  padding: 0.375rem 0.625rem;
  border-radius: 0.5rem;
  background: var(--fd-blue-dark);
  color: var(--fd-beige);
  font-size: var(--fd-small);
  line-height: 1.3;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
}

.fd-chart-key {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin: 0.5rem 0 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
}

.fd-key {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.fd-key--low {
  border: 2px solid var(--fd-blue);
  background: var(--fd-vanilla);
}

.fd-key--avg {
  width: 16px;
  height: 0;
  margin-left: 0.75rem;
  border-top: 2px dashed var(--fd-text-muted);
  border-radius: 0;
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

.fd-save-store {
  color: var(--fd-blue);
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

.fd-bar-cheapest {
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  background: var(--fd-vanilla);
  color: var(--fd-ink);
  font-size: var(--fd-small);
  font-weight: 700;
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
