import axios from 'axios'
import { auth } from '../firebase.js'

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
