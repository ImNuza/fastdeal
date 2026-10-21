<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { catalog, dayLabel, nameFromFile } from '../mock/catalog.js'
import FdIcon from '../components/FdIcon.vue'
import FdLoadingDots from '../components/FdLoadingDots.vue'
import axios from 'axios'

const router = useRouter()
const query = ref('')
const photoName = ref('')
const photoError = ref('')
const photoBusy = ref(false)
const trendingToday = ref([])
const trendingWeek = ref([])

function go(name) {
  const q = String(name || '').trim()
  if (!q) {
    return
  }
  router.push({ path: '/compare', query: { q: q } })
}

function onSearch() {
  const pick = suggestions.value[activeIndex.value]
  go(pick ? pick.name : query.value)
}

// Suggestions under the search bar: catalogue products whose name or alias contains what was typed.
const searchFocused = ref(false)
const activeIndex = ref(-1)

const suggestions = computed(function () {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    return []
  }
  return catalog.filter(function (item) {
    return item.name.toLowerCase().includes(q) || item.aliases.some(function (alias) {
      return alias.includes(q)
    })
  }).slice(0, 5).map(function (item) {
    const start = item.name.toLowerCase().indexOf(q)
    const best = item.listings.reduce(function (a, b) { return b.price < a.price ? b : a })
    return {
      name: item.name,
      // Split the name so the typed part shows in bold, like the matched letters in a place search.
      before: start >= 0 ? item.name.slice(0, start) : '',
      match: start >= 0 ? item.name.slice(start, start + q.length) : '',
      after: start >= 0 ? item.name.slice(start + q.length) : item.name,
      detail: 'From S$' + best.price + ' at ' + best.store + ' · ' + item.listings.length + ' stores'
    }
  })
})

const showSuggestions = computed(function () {
  return searchFocused.value && suggestions.value.length > 0
})

function onQueryInput() {
  activeIndex.value = -1
}

function onQueryKey(event) {
  const count = suggestions.value.length
  if (!count) {
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % count
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = activeIndex.value <= 0 ? count - 1 : activeIndex.value - 1
  } else if (event.key === 'Escape') {
    searchFocused.value = false
  }
}

async function onPhoto(event) {
  const file = event.target.files[0]
  if (!file) {
    return
  }
  photoError.value = ''
  photoName.value = ''
  photoBusy.value = true
  try{
    const form=new FormData()
    form.append('photo', file)
    const res = await fetch('/api/identify-image', { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Could not identify the photo')
    photoName.value = data.name
    router.push({ path: '/compare', query: { q: data.name, from: 'photo' } })
  } catch (e) {
    photoError.value = e.message
  } finally {
    photoBusy.value = false
    event.target.value = ''
  }
}


// Hero

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

// Glide down to Home's search form and put the cursor in the box.
function scrollToSection(id) {
  const section = document.getElementById(id)
  if (!section) {
    return null
  }
  const smooth = !(reduceMotion && reduceMotion.matches)
  section.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
  return section
}

function scrollToSearch() {
  scrollToSection('fd-search')?.querySelector('input')?.focus({ preventScroll: true })
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

//trending page
onMounted(async function retriveTrending() {
 try {
    const res = await axios.get('/api/trending')
    trendingToday.value = res.data.today.slice(0,5)
    
    const shown = []
    for (const t of trendingToday.value) {
      shown.push(t._id)
    }

    trendingWeek.value = []
    for (const item of res.data.week) {
      if (!shown.includes(item._id)) {
        if(trendingWeek.value.length<8){
        trendingWeek.value.push(item)
        }else{
          continue
        }
      }
    }
  } catch (error) {
    console.log(error)
  }
})




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
          <div class="fd-hero-actions">
            <a class="btn btn-dark fd-btn-lg" href="#fd-search" @click.prevent="scrollToSearch">Start comparing</a>
            <a class="btn btn-outline-dark fd-btn-lg" href="#fd-trending" @click.prevent="scrollToSection('fd-trending')">See what's trending</a>
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

  <!-- Search band: blue, full width; the search bar and search history span the container, in line with the logo. -->
  <section id="fd-search" class="fd-search-band">
    <div class="container">
      <h2 class="fd-section-title text-center">Compare the price before you buy</h2>
      <p class="fd-search-text text-center">Type a product name, or upload a photo. FastDeal shows store listings on one page and marks the cheapest.</p>

      <form class="fd-searchbox" role="search" @submit.prevent="onSearch">
        <label class="visually-hidden" for="q">Product name</label>
        <div class="fd-searchbar">
          <input
            id="q"
            v-model="query"
            class="fd-searchbar-input"
            type="text"
            placeholder="Search a product, e.g. Sony WH-1000XM5"
            autocomplete="off"
            role="combobox"
            aria-controls="fd-suggestions"
            :aria-expanded="showSuggestions"
            :aria-activedescendant="activeIndex >= 0 ? 'fd-suggestion-' + activeIndex : undefined"
            @input="onQueryInput"
            @focus="searchFocused = true"
            @blur="searchFocused = false"
            @keydown="onQueryKey"
          />
          <label class="fd-searchbar-icon" for="photo" title="Search by photo">
            <span class="visually-hidden">Search by photo</span>
            <FdIcon name="camera" />
          </label>
          <input id="photo" class="visually-hidden" type="file" accept="image/*" @change="onPhoto" />
          <button class="fd-searchbar-icon" type="submit" aria-label="Search">
            <FdIcon name="search" />
          </button>
        </div>

        <ul v-show="showSuggestions" id="fd-suggestions" class="fd-suggestions" role="listbox">
          <li
            v-for="(item, i) in suggestions"
            :id="'fd-suggestion-' + i"
            :key="item.name"
            class="fd-suggestion"
            :class="{ 'is-active': i === activeIndex }"
            role="option"
            :aria-selected="i === activeIndex"
            @mousedown.prevent="go(item.name)"
            @mouseenter="activeIndex = i"
          >
            <FdIcon name="tag" />
            <span>
              <span class="fd-suggestion-name">{{ item.before }}<strong>{{ item.match }}</strong>{{ item.after }}</span>
              <span class="fd-suggestion-detail">{{ item.detail }}</span>
            </span>
          </li>
        </ul>
      </form>
      <p v-if="photoBusy" class="fd-search-text small mt-3 mb-0 text-center">
        <FdLoadingDots size="inline" message="Identifying your photo" />
      </p>
      <p v-if="photoError" class="fd-search-text small mt-3 mb-0 text-center">{{ photoError }}</p>
      <p v-if="photoName" class="fd-search-text small mt-3 mb-0 text-center">Identified as {{ photoName }}</p>

      <!-- Search history: placeholder, not built yet. -->
      <section class="mt-5">
        <h2 class="fd-section-title">Search history</h2>
      </section>
    </div>
  </section>

  <!-- Trending: left aligned, full container width like the search bar. -->
  <div class="container py-5">
    <!-- Trending products: placeholder, not built yet. The id is the hero's "See what's trending" scroll target. -->
    <section id="fd-trending">
      <h2 class="fd-section-title">Trending products</h2>
    </section>
     <div class="container py-5">
    <!-- Trending products: placeholder, not built yet. The id is the hero's "See what's trending" scroll target. -->
      <section id="fd-trending" style="margin-bottom: 10px;">
        <h2 class="fd-section-title">Trending Today</h2>
      </section>
      <div id="trendingCarousel" class="carousel slide" style="background: #fff; border: var(--fd-border) solid var(--fd-vanilla-line); border-radius: var(--fd-radius); padding-bottom: 1rem; overflow: hidden;">
        <div class="carousel-inner">
          <div v-for="(item,index) in trendingToday" class="carousel-item" :class="{ active: index === 0 }">
             <router-link :to="{ path: '/compare', query: { q: item.query } }" style="text-decoration: none;">
              <img :src="item.image" class="d-block mx-auto" style="width: 100%; height: 400px; object-fit: contain; background: #fff; border-radius: 8px;">
              <div class="text-center">
                <h3>{{ item.query }}</h3>
              </div>
             </router-link>
          </div>
        </div>
        <div class="carousel-indicators" style="position: relative;">
          <button  v-for="(item,index) in trendingToday" type="button" data-bs-target="#trendingCarousel" :data-bs-slide-to="index" :class="{ active: index === 0 }" aria-label="Slide" style="background-color: #25508c; width: 30px; height: 3px; border-radius: 35%; border: 0; margin: 0 4px;"></button>
        </div>
        
        <button class="carousel-control-prev" type="button" data-bs-target="#trendingCarousel" data-bs-slide="prev">
          <span aria-hidden="true" style="color: #25508c; font-size: 6rem; line-height: 1;">&lsaquo;</span>
          <span class="visually-hidden">Previous</span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#trendingCarousel" data-bs-slide="next">
          <span aria-hidden="true" style="color: #25508c; font-size: 6rem; line-height: 1;">&rsaquo;</span>
          <span class="visually-hidden">Next</span>
        </button>
      </div>
    </div>

    <h3 class="fd-section-title">Trending This Week</h3>
    <div class="row g-3 mt-4">
      <div class="col-6 col-md-4 col-lg-3" v-for="item in trendingWeek" :key="item._id">
        <router-link :to="{ path: '/compare', query: { q: item.query } }" style="text-decoration: none;">
          <div class="card h-100" style="padding: 0.75rem; border-radius: 1rem;">
            <img :src="item.image"  class="card-img-top" style="display: block; width: 100%; height: 150px; object-fit: contain; border-radius: 0.75rem; background: var(--fd-beige, #f3ede1); margin-bottom: 0.75rem;">
            <h5 class="card-title" style="margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.3;">{{ item.query }}</h5>
          </div>
        </router-link>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Blue band between the cream header and the rest of the page. */
.fd-search-band {
  padding: 3rem 0;
  background: var(--fd-blue);
  color: var(--fd-beige);
  /* Start comparing scrolls here; the band's top sits right under the sticky navbar. */
  scroll-margin-top: var(--fd-nav-height);
}

.fd-search-band .fd-section-title {
  color: var(--fd-beige);
}

.fd-search-text {
  margin-bottom: 1.5rem;
  color: var(--fd-beige);
  font-size: var(--fd-page-subtitle);
}

/* Search bar: one big pill with the photo and search icons inside it. */
.fd-searchbox {
  position: relative;
}

.fd-searchbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-height: var(--fd-control);
  padding: 0.25rem 0.25rem 0.25rem 1.5rem;
  border-radius: 999px;
  background: var(--fd-paper);
  box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 0.18);
}

.fd-searchbar:focus-within {
  outline: 3px solid var(--fd-vanilla);
  outline-offset: 3px;
}

.fd-searchbar-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--fd-text);
  /* 16px like every input, so phones do not zoom in when it is tapped. */
  font-size: var(--fd-body);
  outline: none;
}

.fd-searchbar-input::placeholder {
  color: var(--fd-text-muted);
}

.fd-searchbar-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--fd-blue);
  cursor: pointer;
}

.fd-searchbar-icon:hover {
  background: var(--fd-beige);
}

/* Suggestions: a frosted panel just under the pill, slightly inset from its ends. */
.fd-suggestions {
  position: absolute;
  z-index: 5;
  top: calc(100% + 0.75rem);
  left: 1rem;
  right: 1rem;
  margin: 0;
  padding: 0.5rem 0;
  list-style: none;
  border-radius: var(--fd-radius);
  background: rgb(251 248 243 / 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 0.18);
  color: var(--fd-text);
  text-align: left;
}

.fd-suggestion {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  color: var(--fd-text-muted);
  cursor: pointer;
}

.fd-suggestion + .fd-suggestion {
  border-top: 1px solid var(--fd-vanilla-line);
}

.fd-suggestion.is-active {
  background: var(--fd-vanilla-soft);
}

.fd-suggestion-name {
  display: block;
  color: var(--fd-text);
}

.fd-suggestion-name strong {
  color: var(--fd-blue);
}

.fd-suggestion-detail {
  display: block;
  font-size: var(--fd-small);
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

.fd-hero-text {
  max-width: 32rem;
  margin-bottom: 2rem;
  color: var(--fd-text-muted);
  font-size: var(--fd-page-subtitle);
  line-height: 1.6;
}

.fd-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
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
  color: var(--fd-blue);
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
