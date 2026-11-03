<script setup>
import { computed } from 'vue'
import { PAGE_SIZE } from '../services/listPages.js'

// Page buttons under a list: Prev, the page numbers, and Next, centred, even for one page, with
// "Showing 9 to 16 of 45 listings" under them. After a move, the top of the list scrolls back
// into view.
const props = defineProps({
  pageCount: {
    type: Number,
    required: true
  },
  // How many rows the whole list has, for the line under the buttons
  total: {
    type: Number,
    required: true
  },
  // What the list holds, plural, for the line under the buttons: "products", "friends".
  // One row drops the s ("1 product"), or uses ONE below for words that change.
  noun: {
    type: String,
    required: true
  },
  // What the pages hold, for screen readers: "Saved products", "Friends"
  label: {
    type: String,
    required: true
  },
  // The list's card, scrolled to after each move
  top: {
    default: null
  }
})

const page = defineModel({ type: Number, required: true })

// The first, last, current, and its neighbours, with a gap marker where pages are skipped:
// 1 2 3 ... 10 on page 1, 1 ... 4 5 6 ... 10 on page 5. Near either end, two neighbours show,
// so the row keeps about the same width.
const slots = computed(function () {
  const last = props.pageCount
  const now = page.value
  const pick = new Set([1, last, now - 1, now, now + 1])
  if (now <= 2) pick.add(3)
  if (now >= last - 1) pick.add(last - 2)
  const pages = [...pick].filter(function (n) { return n >= 1 && n <= last }).sort(function (a, b) { return a - b })

  const out = []
  pages.forEach(function (n, i) {
    const gap = i ? n - pages[i - 1] : 0
    // A gap of one page shows that page rather than a marker taking the same room.
    if (gap === 2) out.push(n - 1)
    else if (gap > 2) out.push('gap' + i)
    out.push(n)
  })
  return out
})

// Plurals that are not just the singular plus s
const ONE = { people: 'person' }

const showing = computed(function () {
  const noun = props.total === 1 ? (ONE[props.noun] || props.noun.replace(/s$/, '')) : props.noun
  const from = (page.value - 1) * PAGE_SIZE + 1
  const to = Math.min(page.value * PAGE_SIZE, props.total)
  // "Showing 1 to 8 of 45 products"; a page with one row reads "Showing 9 of 9 products".
  const range = from === to ? from : from + ' to ' + to
  return 'Showing ' + range + ' of ' + props.total + ' ' + noun
})

function go(n) {
  page.value = Math.min(props.pageCount, Math.max(1, n))
  const el = props.top
  if (!el) return
  // Lists that scroll inside their card (on wider screens) start the new page at the top.
  // Every one of them is focusable for keyboard scrolling, so tabindex="0" finds them.
  el.querySelectorAll('[tabindex="0"]').forEach(function (list) {
    list.scrollTop = 0
  })
  const navHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fd-nav-height')) || 0
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({
    top: el.getBoundingClientRect().top + window.scrollY - navHeight - 16,
    behavior: smooth ? 'smooth' : 'auto'
  })
}
</script>

<template>
  <nav v-if="total > 0" class="fd-pager is-paged" :aria-label="label + ' pages'">
    <div class="fd-pager-row">
      <button class="fd-pager-step" type="button" aria-label="Previous page" :disabled="page <= 1" @click="go(page - 1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
          stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        <span class="fd-pager-step-text">Prev</span>
      </button>

      <template v-for="slot in slots" :key="slot">
        <span v-if="typeof slot === 'string'" class="fd-pager-gap" aria-hidden="true">...</span>
        <button v-else class="fd-pager-num" :class="{ 'is-current': slot === page }" type="button"
          :aria-label="'Page ' + slot" :aria-current="slot === page ? 'page' : null" @click="go(slot)">
          {{ slot }}
        </button>
      </template>

      <button class="fd-pager-step" type="button" aria-label="Next page" :disabled="page >= pageCount" @click="go(page + 1)">
        <span class="fd-pager-step-text">Next</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
          stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>

    <p class="fd-pager-showing" aria-live="polite">{{ showing }}</p>
  </nav>
</template>

<style scoped>
/* Just the "Showing" line: small, on the right of the bar like the old count. */
.fd-pager {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: auto;
}

/* With buttons, FastDeal style: a paper pill with the vanilla outline, blue type, the open page
   filled blue like btn-dark, Prev and Next outlined like btn-outline-dark. The "Showing" line
   sits small under it, and both are centred. */
.fd-pager.is-paged {
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  margin-left: 0;
  padding: 0.25rem 0;
}

.fd-pager-row {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  max-width: 100%;
  padding: 0.375rem;
  border: var(--fd-border) solid var(--fd-vanilla-line);
  border-radius: 999px;
  background: var(--fd-paper);
}

.fd-pager-step,
.fd-pager-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--fd-control-sm);
  border-radius: 999px;
  color: var(--fd-blue);
  font-family: var(--fd-font-body);
  font-size: var(--fd-button-sm);
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.fd-pager-step {
  gap: 0.375rem;
  padding: 0 0.875rem;
  border: var(--fd-border) solid var(--fd-blue);
  background: transparent;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.fd-pager-step svg {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
}

.fd-pager-step:hover:not(:disabled) {
  background: var(--fd-blue);
  color: var(--fd-beige);
}

/* Nowhere to go: faded right back, so it clearly cannot be pressed. */
.fd-pager-step:disabled {
  border-color: var(--fd-vanilla-line);
  color: var(--fd-text-muted);
  opacity: 0.4;
  cursor: not-allowed;
}

.fd-pager-num {
  min-width: var(--fd-control-sm);
  padding: 0 0.5rem;
  border: 0;
  background: transparent;
}

.fd-pager-num:hover:not(.is-current) {
  background: var(--fd-vanilla-soft);
}

/* The open page: filled blue, like btn-dark */
.fd-pager-num.is-current {
  background: var(--fd-blue);
  color: var(--fd-beige);
  cursor: default;
}

.fd-pager-step:focus-visible,
.fd-pager-num:focus-visible {
  outline: 3px solid var(--fd-blue);
  outline-offset: 2px;
}

.fd-pager-gap {
  min-width: 1rem;
  color: var(--fd-text-muted);
  font-weight: 700;
  text-align: center;
}

.fd-pager-showing {
  margin: 0;
  color: var(--fd-text-muted);
  font-size: var(--fd-small);
}

/* Narrow phones: Prev and Next become arrow circles, so 1 ... 4 5 6 ... 10 still fits. */
@media (max-width: 420px) {
  .fd-pager-row {
    gap: 0.25rem;
  }

  .fd-pager-step {
    width: var(--fd-control-sm);
    padding: 0;
  }

  .fd-pager-step-text {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fd-pager-step,
  .fd-pager-num {
    transition: none;
  }
}
</style>
