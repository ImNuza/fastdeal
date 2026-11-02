import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

// Folder tabs: the open tab and the card under it are one piece. When the open tab reaches the
// card's rounded top right corner (the last tab, or any tab once they stretch across a phone),
// that corner has to turn square too, or the curve leaves a notch under the tab.
// Returns true while the open tab reaches that corner.
export function useTabReachesCorner(tabsEl, panelEl, activeTab) {
  const reaches = ref(false)
  let observer = null

  function measure() {
    const tab = tabsEl.value?.querySelector('[aria-selected="true"]')
    const panel = panelEl.value
    if (!tab || !panel) {
      reaches.value = false
      return
    }
    // The panels' corner is --fd-radius, 1rem. Measured from the token rather than the panel,
    // whose corner is already square while this is true.
    const radius = parseFloat(getComputedStyle(document.documentElement).fontSize)
    reaches.value = tab.getBoundingClientRect().right > panel.getBoundingClientRect().right - radius
  }

  // Re-measure when the window, the tabs, or the card change size.
  watch([tabsEl, panelEl], function ([tabs, panel]) {
    observer?.disconnect()
    observer = null
    if (tabs && panel) {
      observer = new ResizeObserver(measure)
      observer.observe(tabs)
      observer.observe(panel)
    }
    measure()
  }, { immediate: true, flush: 'post' })

  watch(activeTab, function () {
    nextTick(measure)
  })

  onBeforeUnmount(function () {
    observer?.disconnect()
  })

  return reaches
}
