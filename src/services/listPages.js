import { computed, onBeforeUnmount, ref, toValue, watch } from 'vue'

// Every list shows 8 rows a page on every screen size, with FdPager's page buttons under them
// (even for one page).
export const PAGE_SIZE = 8
const PHONE = '(max-width: 767.98px)'

// rows: the full list (a ref, computed, or getter). resetOn: anything that starts a new list,
// such as the open tab or the search, which jumps back to page 1. isPhone is still returned for
// layouts that change on phones.
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
    return Math.max(1, Math.ceil(rowCount.value / PAGE_SIZE))
  })

  const pageRows = computed(function () {
    const all = toValue(rows)
    const start = (page.value - 1) * PAGE_SIZE
    return all.slice(start, start + PAGE_SIZE)
  })

  // Removing the last row on the last page steps back to a page that exists instead of
  // showing an empty one.
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
