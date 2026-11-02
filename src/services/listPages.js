import { computed, onBeforeUnmount, ref, toValue, watch } from 'vue'

// Phones have no scrollbar inside the cards, so lists show 10 rows at a time there, with
// FdPager's page buttons always under them (even for one page). Wider screens show the whole
// list, scrolling inside its card, and FdPager shows only its "Showing" line.
export const PAGE_SIZE = 10
const PHONE = '(max-width: 767.98px)'

// rows: the full list (a ref, computed, or getter). resetOn: anything that starts a new list,
// such as the open tab or the search, which jumps back to page 1.
export function useListPages(rows, resetOn) {
  const page = ref(1)

  const phone = window.matchMedia(PHONE)
  const isPhone = ref(phone.matches)
  function onChange(event) {
    isPhone.value = event.matches
  }
  phone.addEventListener('change', onChange)
  onBeforeUnmount(function () {
    phone.removeEventListener('change', onChange)
  })

  const rowCount = computed(function () {
    return toValue(rows).length
  })

  const pageCount = computed(function () {
    if (!isPhone.value) return 1
    return Math.max(1, Math.ceil(rowCount.value / PAGE_SIZE))
  })

  const pageRows = computed(function () {
    const all = toValue(rows)
    if (!isPhone.value) return all
    const start = (page.value - 1) * PAGE_SIZE
    return all.slice(start, start + PAGE_SIZE)
  })

  // Removing the last row on the last page, or widening the window, steps back to a page
  // that exists instead of showing an empty one.
  watch(pageCount, function (count) {
    if (page.value > count) page.value = count
  })

  if (resetOn) {
    watch(resetOn, function () {
      page.value = 1
    })
  }

  return { page, pageCount, pageRows, rowCount, isPhone }
}
