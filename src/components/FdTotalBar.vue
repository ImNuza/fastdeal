<script setup>
// The bar under a list that sticks to the bottom of the screen: the FdPager count ("Total: 5
// friends"), and any page-wide button such as Mark all as read. Put it last in a .fd-list-page,
// so it stops above the footer. Styles are in app.css (.fd-total-bar).
defineProps({
  // True while FdPager shows its page buttons (phones), so they centre with the count under them
  stacked: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <div class="fd-total-bar" :class="{ 'has-pager': stacked }">
    <slot />
  </div>
</template>
