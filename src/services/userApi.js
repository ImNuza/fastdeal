import axios from 'axios'

// Create or return existing MongoDB user after Firebase signup/login.
// Pass username only on first email signup; Google users set it via /set-username.
export async function createOrGetUser(firebaseUid, email, username) {
  const body = { firebaseUid, email }
  if (username) body.username = username
  const { data } = await axios.post('/api/users', body)
  return data
}

// Get the current user's profile from MongoDB.
export async function getUser(firebaseUid) {
  const { data } = await axios.get(`/api/users/${firebaseUid}`)
  return data
}

// Patch the current user — allowed fields: emailAlertsOn, username.
export async function updateUser(firebaseUid, patch) {
  const { data } = await axios.put(`/api/users/${firebaseUid}`, patch)
  return data
}

// Look up a user's email by their username — needed for username-based login
// because Firebase signInWithEmailAndPassword requires an email.
export async function lookupByUsername(username) {
  const { data } = await axios.get('/api/users/lookup', { params: { username } })
  return data // { email, firebaseUid, username }
}
