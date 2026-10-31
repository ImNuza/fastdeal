<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

// A list that scrolls inside its card, with the brand scrollbar beside it: arrows that jump to
// the top or bottom and a blue handle to drag, since browsers on a Mac hide their own until you
// scroll. The same scrollbar as the Friends and Notifications cards. The content scrolls natively
// (wheel, trackpad, touch, keyboard) and the bar follows; the bar can also drive it.
defineProps({
  label: {
    type: String,
    default: 'List'
  }
})

const listEl = ref(null)
const contentEl = ref(null)
const trackEl = ref(null)
const canScroll = ref(false)
const thumbSize = ref(20)
const thumbTop = ref(0)

function updateBar() {
  const el = listEl.value
  if (!el) {
    canScroll.value = false
    return
  }
  const room = el.scrollHeight - el.clientHeight
  canScroll.value = room > 1
  // A small handle: its share of the track, kept between 12% and 40%; 20% with nothing to scroll.
  thumbSize.value = canScroll.value
    ? Math.min(Math.max((el.clientHeight / el.scrollHeight) * 100, 12), 40)
    : 20
  thumbTop.value = canScroll.value
    ? (el.scrollTop / room) * (100 - thumbSize.value)
    : Math.min(thumbTop.value, 100 - thumbSize.value)
}

function moveIdleThumb(top) {
  thumbTop.value = Math.min(Math.max(top, 0), 100 - thumbSize.value)
}

// The arrows jump straight to the very top (-1) or the very bottom (1).
function scrollStep(direction) {
  if (!canScroll.value) {
    moveIdleThumb(direction < 0 ? 0 : 100)
    return
  }
  const el = listEl.value
  el.scrollTo({ top: direction < 0 ? 0 : el.scrollHeight, behavior: 'smooth' })
}

// A press on the empty track jumps one page toward the press.
function onTrackPress(event) {
  const el = listEl.value
  const thumb = trackEl.value.querySelector('.fd-scrollbar-thumb').getBoundingClientRect()
  const direction = event.clientY < thumb.top ? -1 : 1
  if (!canScroll.value) {
    moveIdleThumb(thumbTop.value + direction * thumbSize.value)
    return
  }
  el.scrollBy({ top: direction * el.clientHeight * 0.9, behavior: 'smooth' })
}

// Dragging the handle: moving it the full free length of the track scrolls everything.
let dragStartY = 0
let dragStartScroll = 0
let dragStartTop = 0

function onThumbDown(event) {
  event.preventDefault()
  dragStartY = event.clientY
  dragStartScroll = listEl.value.scrollTop
  dragStartTop = thumbTop.value
  event.currentTarget.setPointerCapture(event.pointerId)
}

function onThumbMove(event) {
  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
  const el = listEl.value
  if (!canScroll.value) {
    moveIdleThumb(dragStartTop + ((event.clientY - dragStartY) / trackEl.value.clientHeight) * 100)
    return
  }
  const free = trackEl.value.clientHeight * (1 - thumbSize.value / 100)
  if (free > 0) {
    el.scrollTop = dragStartScroll + ((event.clientY - dragStartY) * (el.scrollHeight - el.clientHeight)) / free
  }
}

// Back to the top, for a new tab
function toTop() {
  if (listEl.value) listEl.value.scrollTop = 0
  nextTick(updateBar)
}

// Re-measure whenever the box or its content changes size: a new tab, a search, a new sort.
let observer = null

onMounted(function () {
  observer = new ResizeObserver(updateBar)
  observer.observe(listEl.value)
  observer.observe(contentEl.value)
  nextTick(updateBar)
})

onBeforeUnmount(function () {
  observer?.disconnect()
})

defineExpose({ toTop })
</script>

<template>
  <div class="fd-scroll-area">
    <div ref="listEl" class="fd-scroll-area-list" tabindex="0" :aria-label="label" @scroll="updateBar">
      <div ref="contentEl">
        <slot />
      </div>
    </div>

    <!-- Hidden from screen readers: the list itself scrolls with the keyboard. -->
    <div class="fd-scrollbar" aria-hidden="true">
      <button class="fd-scrollbar-arrow" type="button" tabindex="-1" @click="scrollStep(-1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round"><path d="m18 15-6-6-6 6" /></svg>
      </button>
      <div ref="trackEl" class="fd-scrollbar-track" @pointerdown.self="onTrackPress">
        <div class="fd-scrollbar-thumb" :style="{ top: thumbTop + '%', height: thumbSize + '%' }"
          @pointerdown="onThumbDown" @pointermove="onThumbMove"></div>
      </div>
      <button class="fd-scrollbar-arrow" type="button" tabindex="-1" @click="scrollStep(1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* The list and its scrollbar side by side, filling the card's free height */
.fd-scroll-area {
  display: flex;
  flex: 1;
  gap: 0.5rem;
  min-height: 0;
}

.fd-scroll-area-list {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.fd-scroll-area-list::-webkit-scrollbar {
  display: none;
}

.fd-scroll-area-list:focus-visible {
  outline: 3px solid var(--fd-blue);
  outline-offset: 3px;
}

/* Room after the last item, so at the end of the scroll its bottom edge shows above the line */
.fd-scroll-area-list > div {
  padding-bottom: 1.25rem;
}

.fd-scrollbar {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  width: 1.25rem;
  user-select: none;
}

.fd-scrollbar-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--fd-text-muted);
  cursor: pointer;
}

.fd-scrollbar-arrow:hover {
  background: var(--fd-beige);
  color: var(--fd-blue);
}

.fd-scrollbar-arrow svg {
  width: 0.875rem;
  height: 0.875rem;
}

.fd-scrollbar-track {
  position: relative;
  flex: 1;
  width: 0.375rem;
  margin: 0.25rem 0;
  border-radius: 999px;
  background: var(--fd-beige);
  cursor: pointer;
}

/* The handle is brand blue and a little wider than its track, so it is easy to see and grab. */
.fd-scrollbar-thumb {
  position: absolute;
  left: 50%;
  width: 0.625rem;
  border-radius: 999px;
  background: var(--fd-blue);
  transform: translateX(-50%);
  cursor: grab;
  touch-action: none;
}

.fd-scrollbar-thumb:hover,
.fd-scrollbar-thumb:active {
  background: var(--fd-blue-dark);
}

.fd-scrollbar-thumb:active {
  cursor: grabbing;
}
</style>
