import axios from 'axios'

// Create or return the MongoDB user for a Firebase account.
// Safe to call on every login — uses upsert so existing users are not duplicated.
export async function createOrGetUser(firebaseUid, email) {
  const { data } = await axios.post('/api/users', { firebaseUid, email })
  return data
}

// Get the current user's profile from MongoDB.
export async function getUser(firebaseUid) {
  const { data } = await axios.get(`/api/users/${firebaseUid}`)
  return data
}

// Patch the current user (e.g. { emailAlertsOn: false }).
export async function updateUser(firebaseUid, patch) {
  const { data } = await axios.put(`/api/users/${firebaseUid}`, patch)
  return data
}
