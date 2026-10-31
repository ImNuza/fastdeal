import axios from 'axios'
import { auth } from '../firebase.js'
import { useErrorStore } from '../store/error.js'

// Every axios call to our API sends the logged-in user's Firebase ID token.
// The server reads the user from this token, not from a uid in the URL or body.
// getIdToken() returns a cached token and renews it when it is about to expire.
axios.interceptors.request.use(async function (config) {
  const isOurApi = typeof config.url === 'string' && config.url.startsWith('/api/')
  if (isOurApi && auth.currentUser) {
    config.headers.Authorization = 'Bearer ' + (await auth.currentUser.getIdToken())
  }
  return config
})

// When loading a page's data fails because the server is down, broke, or there is no internet,
// the page is swapped for the error page. Only loads (GET) count: a failed save keeps the page,
// so the view can show its own message without losing what the person typed.
// Background checks (the 5 second notification refresh and similar) pass { quiet: true },
// because a missed check is fine and the next one tries again.
axios.interceptors.response.use(undefined, function (error) {
  const config = error.config || {}
  const isLoad = (config.method || 'get') === 'get'
  if (isLoad && !config.quiet && !axios.isCancel(error)) {
    if (!error.response) {
      useErrorStore().showError(navigator.onLine ? 503 : 'offline')
    } else if (error.response.status >= 500) {
      useErrorStore().showError(error.response.status)
    }
  }
  return Promise.reject(error)
})
