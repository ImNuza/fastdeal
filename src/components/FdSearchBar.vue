<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTrendingStore } from '../store/trending.js'
import FdIcon from './FdIcon.vue'
import FdLoadingDots from './FdLoadingDots.vue'
import { addToHistory, readHistory, removeFromHistory } from '../services/searchHistory.js'
import { itemName } from '../services/itemName.js'
import axios from 'axios'

// Home's hero uses the full bar; every other page gets the compact one in the navbar.
const props = defineProps({
  compact: {
    type: Boolean,
    default: false
  }
})

// Ids stay unique if both bars are ever on screen at once.
const prefix = props.compact ? 'fd-nav-search' : 'fd-search'

const route = useRoute()
const router = useRouter()
const query = ref('')
const photoName = ref('')
const photoError = ref('')
const photoBusy = ref(false)
const recentSearches = ref(readHistory())

function go(name) {
  const q = String(name || '').trim()
  if (!q) {
    return
  }
  recentSearches.value = addToHistory(q)
  searchFocused.value = false
  router.push({ path: '/compare', query: { q: q } })
}

function onSearch() {
  const pick = suggestions.value[activeIndex.value]
  go(pick ? pick.name : query.value)
}

// Suggestions under the search bar: recent searches while the box is empty,
// then products people searched this week whose name contains what was typed.
const trendingStore = useTrendingStore()
const { week } = storeToRefs(trendingStore)
trendingStore.ensureTrending()

function nameOf(item) {
  return item.query || item._id
}

const searchFocused = ref(false)
const activeIndex = ref(-1)

const suggestions = computed(function () {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    return recentSearches.value.map(function (name) {
      return { name: name, before: '', match: '', after: itemName(name), detail: 'Recent search', icon: 'clock', recent: true }
    })
  }
  return week.value.filter(function (item) {
    return nameOf(item).toLowerCase().includes(q)
  }).slice(0, 5).map(function (item) {
    const name = nameOf(item)
    const start = name.toLowerCase().indexOf(q)
    return {
      name: name,
      // Split the name so the typed part shows in bold, like the matched letters in a place search.
      before: start >= 0 ? name.slice(0, start) : '',
      match: start >= 0 ? name.slice(start, start + q.length) : '',
      after: start >= 0 ? name.slice(start + q.length) : name,
      detail: item.count + (item.count === 1 ? ' search' : ' searches') + ' this week',
      icon: 'tag'
    }
  })
})

const showSuggestions = computed(function () {
  return searchFocused.value && suggestions.value.length > 0
})

// Recent searches: a logged-in user's come from their account (CompareView records each one),
// so they follow them across devices. A guest gets a 401, so they get this browser's list instead.
async function loadRecentSearches() {
  try {
    const res = await axios.get('/api/me/recent-searches', { quiet: true })
    const names = (res.data.recentSearches || []).map(function (item) { return item.query })
    recentSearches.value = names.filter(Boolean).slice(0, 5)
  } catch (error) {
    recentSearches.value = readHistory()
  }
}

// The x beside a recent search: drop it here, from this browser, and from the account.
// A guest's delete gets a 401, which is fine: their list only lives in the browser.
function removeRecent(name) {
  recentSearches.value = recentSearches.value.filter(function (item) { return item !== name })
  removeFromHistory(name)
  activeIndex.value = -1
  axios.delete('/api/me/recent-searches', { params: { query: name } }).catch(function () {})
}

function onQueryFocus() {
  // Show the local list straight away, then swap in the account's list once it arrives.
  recentSearches.value = readHistory()
  searchFocused.value = true
  loadRecentSearches()
}

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
  } else if (event.key === 'Delete' && suggestions.value[activeIndex.value]?.recent) {
    // Keyboard version of the x: Delete removes the highlighted recent search.
    event.preventDefault()
    removeRecent(suggestions.value[activeIndex.value].name)
  }
}

// The navbar bar outlives page changes, so clear the photo status once the user moves on.
watch(function () { return route.fullPath }, function () {
  photoName.value = ''
  photoError.value = ''
})

async function onPhoto(event) {
  const file = event.target.files[0]
  if (!file) {
    return
  }
  photoError.value = ''
  photoName.value = ''
  photoBusy.value = true
  try {
    const form = new FormData()
    form.append('photo', file)
    const res = await fetch('/api/identify-image', { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Could not identify the photo')
    photoName.value = data.name
    recentSearches.value = addToHistory(data.name)
    router.push({ path: '/compare', query: { q: data.name, from: 'photo' } })
  } catch (e) {
    photoError.value = e.message
  } finally {
    photoBusy.value = false
    event.target.value = ''
  }
}
</script>

<template>
  <div class="fd-searchwrap" :class="{ 'is-compact': compact }">
    <form :id="prefix" class="fd-searchbox" role="search" @submit.prevent="onSearch">
      <label class="visually-hidden" :for="prefix + '-q'">Product name</label>
      <div class="fd-searchbar">
        <input
          :id="prefix + '-q'"
          v-model="query"
          class="fd-searchbar-input"
          type="text"
          :placeholder="compact ? 'Search a product' : 'Search a product, e.g. Sony WH-1000XM5'"
          autocomplete="off"
          role="combobox"
          :aria-controls="prefix + '-suggestions'"
          :aria-expanded="showSuggestions"
          :aria-activedescendant="activeIndex >= 0 ? prefix + '-suggestion-' + activeIndex : undefined"
          @input="onQueryInput"
          @focus="onQueryFocus"
          @blur="searchFocused = false"
          @keydown="onQueryKey"
        />
        <label class="fd-searchbar-icon" :for="prefix + '-photo'" title="Search by photo">
          <span class="visually-hidden">Search by photo</span>
          <FdIcon name="camera" />
        </label>
        <input :id="prefix + '-photo'" class="visually-hidden" type="file" accept="image/*" @change="onPhoto" />
        <button class="fd-searchbar-icon" type="submit" aria-label="Search">
          <FdIcon name="search" />
        </button>
      </div>

      <ul v-show="showSuggestions" :id="prefix + '-suggestions'" class="fd-suggestions" role="listbox">
        <li
          v-for="(item, i) in suggestions"
          :id="prefix + '-suggestion-' + i"
          :key="item.name"
          class="fd-suggestion"
          :class="{ 'is-active': i === activeIndex }"
          role="option"
          :aria-selected="i === activeIndex"
          @mousedown.prevent="go(item.name)"
          @mouseenter="activeIndex = i"
        >
          <FdIcon :name="item.icon" />
          <span>
            <span class="fd-suggestion-name">{{ item.before }}<strong>{{ item.match }}</strong>{{ item.after }}</span>
            <span class="fd-suggestion-detail">{{ item.detail }}</span>
          </span>
          <button
            v-if="item.recent"
            type="button"
            class="fd-suggestion-remove"
            tabindex="-1"
            :aria-label="'Remove ' + item.after + ' from recent searches'"
            title="Remove"
            @mousedown.prevent.stop="removeRecent(item.name)"
          >
            <FdIcon name="x" />
          </button>
        </li>
      </ul>
    </form>
    <div v-if="photoBusy || photoError || photoName" class="fd-search-status" aria-live="polite">
      <FdLoadingDots v-if="photoBusy" size="inline" message="Identifying your photo" />
      <span v-else-if="photoError">{{ photoError }}</span>
      <span v-else>Identified as {{ photoName }}</span>
    </div>
  </div>
</template>

<style scoped>
.fd-searchwrap {
  position: relative;
}

/* Photo search status under the search bar. */
.fd-search-status {
  margin-top: 1rem;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
}

/* Search bar: one big pill with the photo and search icons inside it. */
.fd-searchbox {
  position: relative;
}

.fd-searchbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-height: var(--fd-search);
  /* The right gap matches the bordered search bars (2px border plus 16px), so the icons sit
     the same distance from the edge on every page. */
  padding: 0.25rem calc(1rem + var(--fd-border)) 0.25rem 1.5rem;
  border-radius: 999px;
  background: var(--fd-paper);
  box-shadow: var(--fd-shadow);
}

.fd-searchbar:focus-within {
  outline: 3px solid var(--fd-blue);
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
  width: 2.25rem;
  height: 2.25rem;
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
  box-shadow: var(--fd-shadow);
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

/* The x on a recent search, pushed to the right end of the row. */
.fd-suggestion-remove {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--fd-text-muted);
  cursor: pointer;
}

.fd-suggestion-remove:hover {
  background: var(--fd-blue);
  color: var(--fd-beige);
}

.fd-suggestion-remove .fd-icon {
  width: 1.125rem;
  height: 1.125rem;
}

/* Navbar version: a slimmer, see-through pill on the blue bar that turns solid white when tapped. */
.is-compact .fd-searchbar {
  min-height: var(--fd-control-sm);
  padding: 0.125rem 0.125rem 0.125rem 1rem;
  background: color-mix(in srgb, var(--fd-paper) 14%, transparent);
  box-shadow: none;
  transition: background-color 0.2s ease;
}

.is-compact .fd-searchbar:hover {
  background: color-mix(in srgb, var(--fd-paper) 22%, transparent);
}

.is-compact .fd-searchbar:focus-within {
  background: var(--fd-paper);
  outline-color: var(--fd-vanilla);
  outline-offset: 2px;
}

.is-compact .fd-searchbar-input,
.is-compact .fd-searchbar-icon {
  color: var(--fd-beige);
}

.is-compact .fd-searchbar-input::placeholder {
  color: color-mix(in srgb, var(--fd-beige) 80%, transparent);
}

.is-compact .fd-searchbar:focus-within .fd-searchbar-input {
  color: var(--fd-text);
}

.is-compact .fd-searchbar:focus-within .fd-searchbar-input::placeholder {
  color: var(--fd-text-muted);
}

.is-compact .fd-searchbar:focus-within .fd-searchbar-icon {
  color: var(--fd-blue);
}

.is-compact .fd-searchbar-icon {
  width: 2.25rem;
  height: 2.25rem;
}

.is-compact .fd-searchbar-icon:hover {
  background: color-mix(in srgb, var(--fd-paper) 18%, transparent);
}

.is-compact .fd-searchbar:focus-within .fd-searchbar-icon:hover {
  background: var(--fd-beige);
}

.is-compact .fd-suggestions {
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  z-index: 1050;
}

/* The status floats below the navbar so the bar keeps its height. */
.is-compact .fd-search-status {
  position: absolute;
  z-index: 1050;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  margin: 0;
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  background: var(--fd-paper);
  color: var(--fd-text);
  box-shadow: var(--fd-shadow);
}
</style>
