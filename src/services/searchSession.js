// A random id for one browser visit (it ends when the tab closes).
// searchLogs saves it with each search, so searches made together can be grouped
// ("people who searched this also searched..."). It says nothing about who the user is.
const KEY = 'fastdeal-session'

export function sessionId() {
  try {
    let id = sessionStorage.getItem(KEY)
    if (!id) {
      id = 's-' + Math.random().toString(36).slice(2, 10)
      sessionStorage.setItem(KEY, id)
    }
    return id
  } catch (error) {
    // Storage blocked (private mode): search still works, it just is not grouped.
    return ''
  }
}
