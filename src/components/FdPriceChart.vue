<script setup>
import { computed, ref } from 'vue'
import { dayText, sgd } from '../services/format.js'

// Price history card: title, today's price and its change over the range up top, then a line
// chart with gridlines, and a dotted guide with a tooltip on the hovered day.
const props = defineProps({ points: Array, note: String })

// 7 days or 30 days; with a week or less there is nothing to switch, so no buttons
const range = ref(30)

const ranges = computed(function () {
  if (props.points.length <= 7) return []
  return [
    { days: 7, label: '7 days' },
    { days: 30, label: props.points.length >= 30 ? '30 days' : 'All' }
  ]
})

const shown = computed(function () {
  return props.points.slice(-range.value)
})

function setRange(n) {
  range.value = n
  pick.value = null
}

// Day hovered or tapped; null means no tooltip
const pick = ref(null)

const today = computed(function () { return shown.value[shown.value.length - 1] })
const first = computed(function () { return shown.value[0] })

// Percent change from the first day in the range; null when there is nothing to compare with
const change = computed(function () {
  if (shown.value.length < 2 || !first.value.price) return null
  return Math.round(((today.value.price - first.value.price) / first.value.price) * 1000) / 10
})

// For prices a drop is good news: green down, red up
const changeClass = computed(function () {
  if (!change.value) return 'is-flat'
  return change.value < 0 ? 'is-down' : 'is-up'
})

const changeText = computed(function () {
  return (change.value > 0 ? '+' : '') + change.value + '%'
})

// A tidy step for the gridlines: 1, 2, 2.5 or 5 times a power of ten
function niceStep(raw) {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const r = raw / mag
  if (r <= 1) return mag
  if (r <= 2) return 2 * mag
  if (r <= 2.5) return 2.5 * mag
  if (r <= 5) return 5 * mag
  return 10 * mag
}

// Five gridlines from a tidy bottom to a tidy top around the prices
const ticks = computed(function () {
  const prices = shown.value.map(function (p) { return p.price })
  let lo = Math.min(...prices)
  let hi = Math.max(...prices)
  if (hi === lo) {
    const pad = Math.max(1, lo * 0.1)
    lo = lo - pad
    hi = hi + pad
  }
  let step = niceStep((hi - lo) / 4)
  let bottom = Math.max(0, Math.floor(lo / step) * step)
  while (bottom + step * 4 < hi) {
    step = niceStep(step * 1.01)
    bottom = Math.max(0, Math.floor(lo / step) * step)
  }
  const out = []
  for (let i = 4; i >= 0; i--) {
    out.push(bottom + step * i)
  }
  return out
})

function axisText(v) {
  return 'S$' + Number(v.toFixed(2)).toLocaleString('en-SG')
}

// x from 0 to 100, y from 0 (top) to 100 (bottom)
function xAt(i) {
  const n = shown.value.length
  return n < 2 ? 50 : (i / (n - 1)) * 100
}

function yAt(v) {
  const top = ticks.value[0]
  const bottom = ticks.value[4]
  return 100 - ((v - bottom) / (top - bottom)) * 100
}

const linePoints = computed(function () {
  return shown.value.map(function (p, i) { return xAt(i) + ',' + yAt(p.price) }).join(' ')
})

const dotIndex = computed(function () {
  return pick.value === null ? shown.value.length - 1 : pick.value
})

// About seven dates along the bottom, counted back from today so the last one always shows
function labelEvery() {
  return Math.max(1, Math.ceil(shown.value.length / 7))
}

function showLabel(i) {
  return (shown.value.length - 1 - i) % labelEvery() === 0
}

// Every other date, counted back from today, hides on phones so the dates never run together
function minorLabel(i) {
  return ((shown.value.length - 1 - i) / labelEvery()) % 2 === 1
}

const picked = computed(function () {
  return pick.value === null ? null : shown.value[pick.value]
})

// The tooltip sits right of the guide, or left of it near the right edge
const tipFlip = computed(function () {
  return pick.value !== null && xAt(pick.value) > 70
})
</script>

<template>
  <div class="card fd-chart-card">
    <div class="fd-chart-head">
      <div>
        <h2 class="fd-section-title">Price history</h2>
        <p class="fd-chart-value">{{ sgd(today.price) }}</p>
        <p class="fd-change-row">
          <span v-if="change !== null" class="fd-change" :class="changeClass">{{ changeText }}</span>
          <span>vs {{ dayText(first.day) }}</span>
        </p>
      </div>
      <div class="fd-chart-side">
        <div v-if="ranges.length" class="fd-range" role="group" aria-label="Date range">
          <button v-for="r in ranges" :key="r.days" type="button" class="fd-range-btn"
            :class="{ 'is-active': range === r.days }" :aria-pressed="range === r.days"
            @click="setRange(r.days)">{{ r.label }}</button>
        </div>
        <p class="small text-secondary mb-0"><span class="fd-key"></span>Lowest price</p>
      </div>
    </div>

    <div class="fd-chart">
      <div class="fd-chart-grid" aria-hidden="true">
        <span v-for="t in ticks" :key="t">{{ axisText(t) }}</span>
      </div>
      <div class="fd-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line v-if="picked" class="fd-guide" :x1="xAt(pick)" :x2="xAt(pick)" y1="0" y2="100" />
          <polyline class="fd-line" :points="linePoints" />
        </svg>

        <!-- One dot like the Admin board: on today, or on the hovered day -->
        <span class="fd-dot" :style="{ left: xAt(dotIndex) + '%', top: yAt(shown[dotIndex].price) + '%' }"></span>

        <div v-if="picked" class="fd-tip" :class="{ 'is-flip': tipFlip }"
          :style="{ left: xAt(pick) + '%', top: yAt(picked.price) + '%' }" aria-hidden="true">
          <span class="text-secondary">{{ dayText(picked.day) }}</span>
          <strong>{{ sgd(picked.price) }}</strong>
        </div>

        <!-- Invisible tap columns, one per day -->
        <div class="fd-hits" @mouseleave="pick = null">
          <button v-for="(p, i) in shown" :key="p.day" type="button"
            :aria-label="dayText(p.day) + ': ' + sgd(p.price)"
            @mouseenter="pick = i" @focus="pick = i" @blur="pick = null" @click="pick = i"></button>
        </div>
      </div>
    </div>

    <div class="fd-chart-x" aria-hidden="true">
      <template v-for="(p, i) in shown" :key="p.day">
        <span v-if="showLabel(i)"
          :class="{ 'is-picked': i === pick, 'is-start': i === 0, 'is-end': i === shown.length - 1, 'is-minor': minorLabel(i) }"
          :style="{ left: xAt(i) + '%' }">{{ dayText(p.day) }}</span>
      </template>
    </div>

    <p v-if="note" class="small text-secondary mt-3 mb-0">{{ note }}</p>
  </div>
</template>

<style scoped>
.fd-chart-card {
  padding: var(--fd-card-pad);
}

.fd-chart-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

/* Today's price: Anton at the page title size, like the "You save" amount */
.fd-chart-value {
  margin: 0.25rem 0 0.5rem;
  color: var(--fd-blue);
  font-family: var(--fd-font-display);
  font-size: var(--fd-page-title);
  line-height: 1;
}

.fd-change-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
  font-weight: 700;
}

/* Pill chip like the Admin board's. For prices a drop is good news: green down, red up */
.fd-change {
  padding: 0.125rem 0.625rem;
  border-radius: 999px;
  color: var(--fd-ink);
  font-size: var(--fd-small);
  font-weight: 700;
  line-height: 1.4;
}

.fd-change.is-down {
  background: var(--fd-green);
}

.fd-change.is-up {
  background: var(--fd-red);
}

.fd-change.is-flat {
  background: var(--fd-vanilla-soft);
}

.fd-chart-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

/* Pill buttons like the Admin board's date range */
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

.fd-key {
  display: inline-block;
  width: 1.5rem;
  height: 3px;
  margin-right: 0.5rem;
  border-radius: 2px;
  background: var(--fd-blue);
  vertical-align: middle;
}

/* Left gutter wide enough for prices like S$1,250 */
.fd-chart {
  position: relative;
  height: 14rem;
  padding-left: 4.5rem;
}

.fd-chart-grid {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.fd-chart-grid span {
  height: 0;
  border-top: 1px solid var(--fd-grey-line);
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
  line-height: 0;
}

.fd-plot {
  position: relative;
  height: 100%;
}

.fd-plot svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.fd-line {
  fill: none;
  stroke: var(--fd-blue);
  stroke-width: 2.5;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.fd-guide {
  stroke: var(--fd-blue);
  stroke-width: 1.5;
  stroke-dasharray: 2 4;
  vector-effect: non-scaling-stroke;
}

/* Same dot as the Admin board charts */
.fd-dot {
  position: absolute;
  width: 0.875rem;
  height: 0.875rem;
  border: 3px solid var(--fd-paper);
  border-radius: 50%;
  background: var(--fd-blue);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.fd-tip {
  position: absolute;
  z-index: 1;
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--fd-grey-line);
  border-radius: 0.5rem;
  background: var(--fd-paper);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  font-size: var(--fd-small);
  white-space: nowrap;
  transform: translate(0.75rem, -50%);
  pointer-events: none;
}

.fd-tip strong {
  color: var(--fd-blue);
}

.fd-tip.is-flip {
  transform: translate(calc(-100% - 0.75rem), -50%);
}

.fd-hits {
  position: absolute;
  inset: 0;
  display: flex;
}

.fd-hits button {
  flex: 1;
  padding: 0;
  border: 0;
  background: transparent;
}

/* Dates sit centred under their point on the line; the end ones line up with the edges */
.fd-chart-x {
  position: relative;
  height: 1.5rem;
  margin: 0.75rem 0 0 4.5rem;
}

.fd-chart-x span {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
  white-space: nowrap;
}

.fd-chart-x span.is-start {
  transform: none;
}

.fd-chart-x span.is-end {
  transform: translateX(-100%);
}

@media (max-width: 575.98px) {
  .fd-chart-x span.is-minor {
    display: none;
  }
}

.fd-chart-x span.is-picked {
  color: var(--fd-blue);
  font-weight: 700;
}
</style>
