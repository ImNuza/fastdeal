// The last few product searches, kept in this browser so Home can offer them again.
const KEY = 'fastdeal-search-history'
const MAX = 5

export function readHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list.slice(0, MAX) : []
  } catch (error) {
    return []
  }
}

// Drops one search, matched without caring about capitals.
export function removeFromHistory(name) {
  const q = String(name || '').trim().toLowerCase()
  const next = readHistory().filter(function (item) {
    return item.toLowerCase() !== q
  })
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch (error) {
    // Storage blocked (private mode): nothing was saved, so nothing to remove.
  }
  return next
}

// Newest first; searching the same thing again moves it back to the top.
export function addToHistory(name) {
  const q = String(name || '').trim()
  if (!q) {
    return readHistory()
  }
  const list = readHistory().filter(function (item) {
    return item.toLowerCase() !== q.toLowerCase()
  })
  list.unshift(q)
  const next = list.slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch (error) {
    // Storage blocked (private mode): search still works, it just is not remembered.
  }
  return next
}
