<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// Loading state, option A: three dots pulse in turn like a price ticker.
// Two dots are brand blue, the last one is deal green.
// size 'page' fills the slot where the results will appear.
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
    <span class="fd-load-dots" aria-hidden="true">
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

.fd-load.is-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 16rem;
  padding: 2.5rem 1.5rem;
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

.is-page .fd-load-message {
  color: var(--fd-blue);
  font-size: 1.125rem;
  line-height: 1.3;
}

.fd-load-time {
  color: var(--fd-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.is-page .fd-load-time {
  font-size: var(--fd-small);
  font-weight: 500;
  letter-spacing: 0.04em;
}

.fd-load-note {
  color: var(--fd-text-muted);
}

.is-page .fd-load-note {
  max-width: 24rem;
  font-size: var(--fd-small);
}

/* Inline takes the colour of its button or cell */
.is-inline .fd-load-time,
.is-inline .fd-load-note {
  color: inherit;
  opacity: 0.75;
}

.fd-load-note:empty {
  display: none;
}

/* Dots */

.fd-load-dots {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  height: 2.5rem;
}

.fd-load-dots span {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--fd-blue);
  animation: fd-load-pulse 1s ease-in-out infinite;
}

.fd-load-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

/* The last dot is the deal */
.fd-load-dots span:nth-child(3) {
  background: var(--fd-green);
  animation-delay: 0.4s;
}

.is-inline .fd-load-dots {
  gap: 0.3em;
  height: 1em;
}

.is-inline .fd-load-dots span {
  width: 0.4em;
  height: 0.4em;
  background: currentColor;
}

.is-inline .fd-load-dots span:nth-child(3) {
  background: var(--fd-green);
}

@keyframes fd-load-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fd-load-pulse {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.45);
  }
}

/* No movement: still dots, graded so they still read as "working". The timer keeps counting. */
@media (prefers-reduced-motion: reduce) {
  .fd-load {
    animation: fd-load-in 0s 0.3s both;
  }

  .fd-load-dots span {
    animation: none;
  }

  .fd-load-dots span:nth-child(1) {
    opacity: 0.45;
  }

  .fd-load-dots span:nth-child(2) {
    opacity: 0.7;
  }
}
</style>
