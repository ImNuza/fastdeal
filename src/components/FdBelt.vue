<script setup>
import { computed, ref } from 'vue'

// A belt of cards that rolls left nonstop, like a conveyor belt. Used by Home's Trending Today and
// Compare's "Customers who viewed this also viewed" on phones, so both move the same way.
// One pass repeats the items until it holds at least BELT_MIN cards (so a short list still fills
// the screen), and the pass is drawn twice; the animation moves exactly one pass, so it loops
// seamlessly. It pauses on hover, focus, or touch, and never moves for anyone who asked for
// reduced motion (the row scrolls by hand instead).
// The slot draws each card and gets { item, tabindex }: only the first copy of each real item is
// tabbable, and every repeat is hidden from screen readers.
const props = defineProps({
  items: { type: Array, required: true },
  label: { type: String, required: true }
})

const BELT_MIN = 8
const BELT_SECONDS_PER_CARD = 5

const pass = computed(function () {
  if (!props.items.length) {
    return []
  }
  let cards = []
  while (cards.length < BELT_MIN) {
    cards = cards.concat(props.items)
  }
  return cards
})

const seconds = computed(function () {
  return pass.value.length * BELT_SECONDS_PER_CARD
})

// Touch has no hover, so a finger on the belt holds it still until it lifts.
const held = ref(false)
</script>

<template>
  <div
    class="fd-belt"
    :class="{ 'is-held': held }"
    :aria-label="label"
    @touchstart.passive="held = true"
    @touchend="held = false"
    @touchcancel="held = false"
  >
    <div class="fd-belt-track" :style="{ '--belt-seconds': seconds + 's' }">
      <template v-for="copy in 2" :key="'pass-' + copy">
        <div
          v-for="(item, index) in pass"
          :key="copy + '-' + index"
          class="fd-belt-item"
          :aria-hidden="copy === 2 || index >= items.length"
        >
          <slot :item="item" :tabindex="copy === 1 && index < items.length ? 0 : -1" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* One long row of cards. The track holds the pass twice, so moving it by half its width lands on
   an identical frame and the loop never jumps. Cards are two, three, then four across, worked out
   from the belt's own width with container units, plus a 1rem gap. */
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

/* Each card fills its slot on the belt. */
.fd-belt-item {
  display: flex;
  flex: 0 0 var(--card);
}

.fd-belt-item > :deep(*) {
  flex: 1 1 auto;
  min-width: 0;
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
</style>
