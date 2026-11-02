<script setup>
import FdIcon from './FdIcon.vue'

// The blue circle with beige initials (Friends, Admin users, Account) or a beige icon
// (Notifications). Initials go in the slot; pass icon instead for an icon. Styles are in
// app.css (.fd-avatar).
defineProps({
  // An FdIcon name, shown instead of the slot
  icon: {
    type: String,
    default: ''
  },
  // md is 44px for list rows; lg is for the Account page header
  size: {
    type: String,
    default: 'md'
  }
})
</script>

<template>
  <span class="fd-avatar" :class="'fd-avatar-' + size" aria-hidden="true">
    <FdIcon v-if="icon" :name="icon" />
    <slot v-else />
  </span>
</template>
