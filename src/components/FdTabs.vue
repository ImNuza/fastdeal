<script setup>
import { ref } from 'vue'
import { useTabReachesCorner } from '../services/folderTabs.js'

// Folder tabs and the card under them, as one piece: the open tab is paper, joined to the paper
// card below, with a short blue line under its label. Friends, Notifications, Wishlist, and
// Admin's Manage Users all use it. The page puts the open tab's content in the slot; styles are
// in app.css (.fd-tabs).
const props = defineProps({
  // [{ id, label, count, countLabel }]. A count above 0 shows the .fd-count bubble after the
  // label; countLabel, if given, is what screen readers hear instead ("3 unread").
  tabs: {
    type: Array,
    required: true
  },
  // What the tabs are for, for screen readers: "Friends"
  label: {
    type: String,
    required: true
  },
  // Start of each tab's id ("fd-tab" gives fd-tab-requests) and of the card's (fd-tab-panel)
  idPrefix: {
    type: String,
    default: 'fd-tab'
  }
})

// The open tab's id
const active = defineModel({ type: String, required: true })

// Squares the card's top right corner while the open tab reaches it.
const tabsEl = ref(null)
const panelEl = ref(null)
const tabAtCorner = useTabReachesCorner(tabsEl, panelEl, active)

// Arrow keys move between tabs, as tab lists do.
function onTabKey(event, index) {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!step) return
  const next = props.tabs[(index + step + props.tabs.length) % props.tabs.length]
  active.value = next.id
  document.getElementById(props.idPrefix + '-' + next.id)?.focus()
}

// The card, for FdPager's :top, so a new page scrolls back to it
defineExpose({ panel: panelEl })
</script>

<template>
  <div class="fd-tabs">
    <div ref="tabsEl" class="fd-tabs-list" role="tablist" :aria-label="label">
      <button v-for="(tab, i) in tabs" :id="idPrefix + '-' + tab.id" :key="tab.id" class="fd-tab"
        :class="{ 'is-active': active === tab.id }" type="button" role="tab" :aria-selected="active === tab.id"
        :aria-controls="idPrefix + '-panel'" :tabindex="active === tab.id ? 0 : -1" @click="active = tab.id"
        @keydown="onTabKey($event, i)">
        <span class="fd-tab-label">{{ tab.label }}</span>
        <span v-if="tab.count" class="fd-count" :aria-label="tab.countLabel">{{ tab.count }}</span>
      </button>
    </div>

    <div ref="panelEl" :id="idPrefix + '-panel'" class="fd-tabs-panel"
      :class="{ 'is-first-open': active === tabs[0].id, 'is-corner-open': tabAtCorner }" role="tabpanel"
      :aria-labelledby="idPrefix + '-' + active">
      <slot />
    </div>
  </div>
</template>
