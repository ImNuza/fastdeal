<script setup>
import FdIcon from './FdIcon.vue'

// An empty list: a blue icon and one short line in the middle of the card, such as "No requests
// waiting." The line goes in the slot; anything after it (like a New budget button) goes in the
// action slot. Styles are in app.css (.fd-empty-state).
defineProps({
  // An FdIcon name
  icon: {
    type: String,
    required: true
  }
})
</script>

<template>
  <div class="fd-empty-state">
    <FdIcon :name="icon" class="fd-empty-icon" />
    <p class="fd-empty-text"><slot /></p>
    <slot name="action" />
  </div>
</template>
