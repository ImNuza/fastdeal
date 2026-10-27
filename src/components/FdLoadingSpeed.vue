<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// Loading state, option B: the three speed lines from the FdLogo shoot out and trail away.
// size 'page' is a blue panel like the navbar, with the message in the logo font.
// size 'inline' fits a table cell, a button or a line of text.
const props = defineProps({
  // What the app is doing, for example "Comparing prices across stores"
  message: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: 'page',
    validator: function (value) {
      return ['page', 'inline'].includes(value)
    }
  },
  // Date.now() when the request started. Without it, the timer starts at mount.
  startedAt: {
    type: Number,
    default: null
  },
  // Shown from SLOW_AFTER seconds. The inline size shows a short version.
  slowNote: {
    type: String,
    default: 'Still working. The first search can take up to 10 seconds.'
  }
})

const SLOW_AFTER = 8
const TICK_MS = 100

const mountedAt = Date.now()
const now = ref(mountedAt)
let timer = null

const seconds = computed(function () {
  return Math.max(0, (now.value - (props.startedAt || mountedAt)) / 1000)
})

// "4.2 s" with a no-break space, so the unit never wraps alone
const elapsed = computed(function () {
  return seconds.value.toFixed(1) + ' s'
})

const note = computed(function () {
  if (seconds.value < SLOW_AFTER) {
    return ''
  }
  return props.size === 'page' ? props.slowNote : 'Still working.'
})

onMounted(function () {
  timer = setInterval(function () {
    now.value = Date.now()
  }, TICK_MS)
})

onBeforeUnmount(function () {
  clearInterval(timer)
})
</script>

<template>
  <!-- spans only, so the inline size is valid inside a button -->
  <span class="fd-load" :class="'is-' + size">
    <span class="fd-load-lines" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </span>
    <span class="fd-load-message" role="status" aria-live="polite">{{ message }}</span>
    <!-- Hidden from screen readers, so the number is not read out 10 times a second -->
    <span class="fd-load-time" aria-hidden="true">{{ elapsed }}</span>
    <!-- Always in the page, so the note is read once when it appears -->
    <span class="fd-load-note" role="status" aria-live="polite">{{ note }}</span>
  </span>
</template>

<style scoped>
.fd-load {
  /* Hidden for the first 300 ms, so a cached load never flashes */
  animation: fd-load-in 0.2s ease-out 0.3s both;
}

/* Page: lines and message on one row like the logo, timer and note below */
.fd-load.is-page {
  display: grid;
  grid-template-columns: auto auto;
  justify-content: center;
  align-items: center;
  gap: 0.5rem 0.75rem;
  min-height: 16rem;
  padding: 2.5rem 1.5rem;
  border-radius: var(--fd-radius);
  background: var(--fd-blue);
  color: var(--fd-beige);
  text-align: center;
}

.fd-load.is-inline {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5em;
  font-size: var(--fd-small);
  line-height: 1.3;
  vertical-align: middle;
}

.fd-load-message {
  font-weight: 700;
}

/* Same as every page title: Anton at the page title size (36px, 48px from 768px). */
.is-page .fd-load-message {
  font-family: var(--fd-font-display);
  font-size: var(--fd-page-title);
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: 0.005em;
  text-align: left;
  text-transform: uppercase;
  transform: skewX(-6deg);
}

.fd-load-time {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.is-page .fd-load-time,
.is-page .fd-load-note {
  grid-column: 1 / -1;
}

/* The timer and the slow note are body size, like the text on every page. */
.is-page .fd-load-time {
  color: var(--fd-vanilla);
  font-size: var(--fd-body);
  font-weight: 500;
  letter-spacing: 0.04em;
}

.is-page .fd-load-note {
  justify-self: center;
  max-width: 32rem;
  font-size: var(--fd-body);
}

/* Inline takes the colour of its button or cell */
.is-inline .fd-load-time,
.is-inline .fd-load-note {
  opacity: 0.75;
}

.fd-load-note:empty {
  display: none;
}

/* Speed lines: same widths, gap and slant as FdLogo.vue */

.fd-load-lines {
  display: grid;
  justify-items: end;
  gap: 0.2em;
  font-size: 1.25em;
  transform: skewX(-12deg);
}

.is-page .fd-load-lines {
  color: var(--fd-vanilla);
  font-size: 3rem;
}

.fd-load-lines span {
  display: block;
  height: 0.12em;
  border-radius: 999px;
  background: currentColor;
  transform-origin: right center;
  animation: fd-load-streak 1.2s cubic-bezier(0.2, 0.7, 0.3, 1) infinite;
}

.fd-load-lines span:nth-child(1) {
  width: 0.55em;
}

.fd-load-lines span:nth-child(2) {
  width: 0.85em;
  animation-delay: 0.15s;
}

.fd-load-lines span:nth-child(3) {
  width: 0.4em;
  animation-delay: 0.3s;
}

@keyframes fd-load-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Each line shoots out from the word, holds, then trails away to the left */
@keyframes fd-load-streak {
  0% {
    opacity: 0.3;
    transform: scaleX(0.2);
  }
  40%,
  60% {
    opacity: 1;
    transform: scaleX(1);
  }
  100% {
    opacity: 0.3;
    transform: translateX(-40%) scaleX(0.4);
  }
}

/* No movement: the lines stay still, exactly like the logo. The timer keeps counting. */
@media (prefers-reduced-motion: reduce) {
  .fd-load {
    animation: fd-load-in 0s 0.3s both;
  }

  .fd-load-lines span {
    animation: none;
  }
}
</style>
