<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { catalog, dayLabel } from '../mock/catalog.js'

// The hero analytics all come from one real catalogue product.
const product = catalog[0]
const history = product.history
const listings = product.listings.slice().sort(function (a, b) {
  return a.price - b.price
})

const cheapest = listings[0]
const priciest = listings[listings.length - 1]
const saving = priciest.price - cheapest.price
const low = Math.min.apply(null, history)
const high = Math.max.apply(null, history)
const average = Math.round(history.reduce(function (sum, n) { return sum + n }, 0) / history.length)
const today = history[history.length - 1]
const lowIndex = history.indexOf(low)

function money(n) {
  return 'S$' + Math.round(n)
}

// Price history chart geometry (SVG units).
const chart = { width: 320, height: 150, top: 16, right: 12, bottom: 24, left: 12 }
const yMin = low - 15
const yMax = high + 15

function xAt(i) {
  return chart.left + (i * (chart.width - chart.left - chart.right)) / (history.length - 1)
}

function yAt(price) {
  const plot = chart.height - chart.top - chart.bottom
  return chart.top + ((yMax - price) * plot) / (yMax - yMin)
}

const linePath = history.map(function (price, i) {
  return (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ' ' + yAt(price).toFixed(1)
}).join(' ')

const areaPath = linePath +
  ' L' + xAt(history.length - 1).toFixed(1) + ' ' + (chart.height - chart.bottom) +
  ' L' + xAt(0).toFixed(1) + ' ' + (chart.height - chart.bottom) + ' Z'

const averageY = yAt(average)

const hoverIndex = ref(null)
const chartBox = ref(null)

function onChartPointer(event) {
  const box = chartBox.value.getBoundingClientRect()
  const ratio = (event.clientX - box.left) / box.width
  const svgX = ratio * chart.width
  const step = (chart.width - chart.left - chart.right) / (history.length - 1)
  const index = Math.round((svgX - chart.left) / step)
  hoverIndex.value = Math.min(Math.max(index, 0), history.length - 1)
}

function clearChartPointer() {
  hoverIndex.value = null
}

const tooltip = computed(function () {
  if (hoverIndex.value === null) {
    return null
  }
  const i = hoverIndex.value
  return {
    left: (xAt(i) / chart.width) * 100 + '%',
    x: xAt(i),
    y: yAt(history[i]),
    date: dayLabel(history.length - 1 - i),
    price: money(history[i])
  }
})

const chartSummary = 'Price of ' + product.name + ' over the last 14 days, from ' + money(history[0]) +
  ' to ' + money(today) + ' today. Lowest ' + money(low) + ', average ' + money(average) + '.'

// Extra you would pay at each store compared with the cheapest one.
const overpay = listings.map(function (item) {
  return {
    store: item.store,
    extra: item.price - cheapest.price,
    width: saving ? ((item.price - cheapest.price) / saving) * 100 : 0
  }
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

onBeforeUnmount(function () {
  window.removeEventListener('scroll', onScroll)
  if (frame) {
    window.cancelAnimationFrame(frame)
  }
})
</script>

<template>
  <div class="fd-landing">
    <section ref="hero" class="fd-hero">
      <div class="container fd-hero-grid">
        <div class="fd-hero-copy">
          <p class="fd-eyebrow">Price analytics for shoppers</p>
          <h1 class="fd-display">Know the <span class="fd-highlight">best deal</span> before you buy</h1>
          <p class="fd-hero-text">
            FastDeal puts every store's price on one page, tracks the last 14 days, and tells you if today is a good day to buy.
          </p>
          <div class="fd-hero-actions">
            <router-link class="btn btn-dark fd-cta" to="/search">Start comparing</router-link>
            <router-link class="btn btn-outline-dark fd-cta" to="/trending">See what's trending</router-link>
          </div>
        </div>

        <div class="fd-cluster">
          <article class="fd-card fd-card--history">
            <header class="fd-card-head">
              <p class="fd-card-label">{{ product.name }}</p>
              <p class="fd-card-value">{{ money(today) }} <span class="fd-card-note">today</span></p>
              <p class="fd-card-meta">14-day low {{ money(low) }} · average {{ money(average) }}</p>
            </header>
            <div
              ref="chartBox"
              class="fd-chart"
              @pointermove="onChartPointer"
              @pointerdown="onChartPointer"
              @pointerleave="clearChartPointer"
            >
              <svg :viewBox="'0 0 ' + chart.width + ' ' + chart.height" role="img" :aria-label="chartSummary">
                <path class="fd-chart-area" :d="areaPath" />
                <line
                  class="fd-chart-average"
                  :x1="chart.left"
                  :x2="chart.width - chart.right"
                  :y1="averageY"
                  :y2="averageY"
                />
                <path class="fd-chart-line" :d="linePath" />
                <circle class="fd-chart-low" :cx="xAt(lowIndex)" :cy="yAt(low)" r="5" />
                <circle class="fd-chart-today" :cx="xAt(history.length - 1)" :cy="yAt(today)" r="5" />
                <g v-if="tooltip">
                  <line class="fd-chart-cross" :x1="tooltip.x" :x2="tooltip.x" :y1="chart.top" :y2="chart.height - chart.bottom" />
                  <circle class="fd-chart-hover" :cx="tooltip.x" :cy="tooltip.y" r="5" />
                </g>
                <text class="fd-chart-axis" :x="chart.left" :y="chart.height - 6">{{ dayLabel(13) }}</text>
                <text class="fd-chart-axis" :x="chart.width - chart.right" :y="chart.height - 6" text-anchor="end">Today</text>
              </svg>
              <div v-if="tooltip" class="fd-tooltip" :style="{ left: tooltip.left }" aria-hidden="true">
                <span>{{ tooltip.date }}</span>
                <strong>{{ tooltip.price }}</strong>
              </div>
            </div>
            <p class="fd-chart-key">
              <span class="fd-key fd-key--low"></span>14-day low
              <span class="fd-key fd-key--avg"></span>Average
            </p>
          </article>

          <article class="fd-card fd-card--saving">
            <p class="fd-card-label">You save</p>
            <p class="fd-stat">{{ money(saving) }}</p>
            <p class="fd-card-meta">buying at {{ cheapest.store }} instead of {{ priciest.store }}</p>
            <p class="fd-chip">Cheapest: {{ cheapest.store }}</p>
          </article>

          <article class="fd-card fd-card--stores">
            <p class="fd-card-label">Extra you'd pay vs cheapest</p>
            <ul class="fd-bars">
              <li v-for="row in overpay" :key="row.store" class="fd-bar-row" :title="row.store + ': +' + money(row.extra)">
                <span class="fd-bar-store">{{ row.store }}</span>
                <span class="fd-bar-track">
                  <span v-if="row.extra" class="fd-bar" :style="{ width: row.width + '%' }"></span>
                </span>
                <span class="fd-bar-value">{{ row.extra ? '+' + money(row.extra) : 'Cheapest' }}</span>
              </li>
            </ul>
          </article>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.fd-landing {
  overflow-x: clip;
}

/* Hero: editorial split, copy left, analytics cluster right */

.fd-hero {
  --p-stores: 0;
  --p-saving: 0;
  --p-history: 0;
  /* Fill the first screen below the sticky navbar, so the footer only appears after scrolling. */
  display: flex;
  align-items: center;
  min-height: calc(100svh - var(--fd-nav-height));
  padding: 3.5rem 0 4rem;
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
  .fd-hero {
    padding: 5rem 0;
  }

  .fd-hero-grid {
    grid-template-columns: 5fr 6fr;
  }
}

.fd-eyebrow {
  margin-bottom: 1rem;
  color: var(--fd-blue);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
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

.fd-hero-text {
  max-width: 32rem;
  margin-bottom: 2rem;
  color: var(--fd-text-muted);
  font-size: 1.125rem;
  line-height: 1.6;
}

.fd-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.fd-cta {
  display: inline-flex;
  align-items: center;
  min-height: 52px;
  padding: 0.75rem 1.5rem;
  font-size: 1.0625rem;
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

  .fd-card--stores {
    top: 0;
    right: 0;
    width: 44%;
    z-index: 2;
  }

  .fd-card--saving {
    bottom: 0;
    right: 0;
    width: 36%;
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
  color: var(--fd-text);
  font-family: var(--fd-font-display);
  font-size: 2rem;
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

/* Price history chart */

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
.fd-chart-today,
.fd-chart-hover {
  stroke: var(--fd-paper);
  stroke-width: 2;
}

.fd-chart-low {
  fill: #2f6b47;
}

.fd-chart-today,
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
  font-size: 11px;
}

.fd-tooltip {
  position: absolute;
  top: -0.5rem;
  transform: translate(-50%, -100%);
  display: grid;
  padding: 0.375rem 0.625rem;
  border-radius: 0.5rem;
  background: var(--fd-ink);
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
  background: #2f6b47;
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
  font-size: 3.5rem;
  line-height: 1;
}

.fd-chip {
  display: inline-block;
  white-space: nowrap;
  margin: 0.75rem 0 0;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: var(--fd-green);
  color: var(--fd-ink);
  font-size: var(--fd-small);
  font-weight: 700;
}

/* Overpay bars */

.fd-bars {
  display: grid;
  gap: 0.5rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}

.fd-bar-row {
  display: grid;
  grid-template-columns: 5.5rem 1fr 4rem;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--fd-small);
}

.fd-bar-store {
  color: var(--fd-text);
}

.fd-bar-track {
  height: 10px;
  border-radius: 999px;
  background: var(--fd-beige);
}

.fd-bar {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--fd-red);
}

.fd-bar-value {
  color: var(--fd-text-muted);
  text-align: right;
}
</style>
